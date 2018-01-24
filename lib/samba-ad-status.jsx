var cockpit = require("cockpit");
var React = require("react");

import $ from "jquery";
import dialog from "cockpit-components-dialog.jsx"
import OnOff from "cockpit-components-onoff.jsx"

import utils from "samba-ad-utils.jsx"

/* FIREWALL */

class FirewallPorts extends React.Component {
    constructor() {
        super();
        this.state = { };
    }

    componentDidMount() {
        var self = this;

        self.firewalld = cockpit.dbus("org.fedoraproject.FirewallD1");
        self.zone = self.firewalld.proxy("org.fedoraproject.FirewallD1.zone",
                                         "/org/fedoraproject/FirewallD1");
        self.props.ports.forEach(p => {
            self.zone.call("queryService", [ "", p ]).
                 done(r => {
                     var s = { }; s[p] = r[0];
                     self.setState(s);
                 });
        });

        $(self.zone).on("ServiceAdded", (event, zone, service) => {
            // XXX - we ignore zone
            if (service in self.state) {
                var s = { }; s[service] = true;
                self.setState(s);
            }
        });

        $(self.zone).on("ServiceRemoved", (event, zone, service) => {
            // XXX - we ignore zone
            if (service in self.state) {
                var s = { }; s[service] = false;
                self.setState(s);
            }
        });
    }

    render() {
        var self = this;

        function row(p) {
            function toggle(val) {
                // XXX - this only affects the runtime config
                if (val) {
                    self.zone.call("addService", [ "", p, 0 ]).
                         fail(err => {
                             console.warn("Failed to open port", p, err.message || err);
                         });
                } else {
                    self.zone.call("removeService", [ "", p ]).
                         fail(err => {
                             console.warn("Failed to close port", p, err.message || err);
                         });
                }
            }

            return (
                <tr>
                    <td>{p}</td>
                    <td>
                        { self.state[p] === undefined? null : <OnOff.OnOffSwitch state={self.state[p]}
                                                                                 onChange={toggle}/>
                        }
                    </td>
                </tr>
            );
        }

        return (
            <div>
                <h3>Network Ports</h3>
                <table className="port-status-table">
                    { this.props.ports.map(row) }
                </table>
            </div>
        );
    }
}

/* STATUS */

function parse_ipactl_status(text, conf) {
    var config_re = /^(.+)=(.+)$/;
    var config = { };

    conf.split("\n").forEach(l => {
        var m = config_re.exec(l);
        if (m)
            config[m[1].trim()] = m[2].trim();
    });

    var service_re = /^(.+) Service: (.+)$/;
    var services = [ ];
    var stopped = true;

    text.split("\n").forEach(l => {
        var m = service_re.exec(l);
        if (m) {
            var name = m[1];
            var unit;
            var status, status_class;

            if (name == "Directory" && config.realm)
                name = "dirsrv@" + config.realm;

            // XXX - ipctl should tell us the unit
            unit = name + ".service";

            status = status_class = m[2];
            if (status_class == "RUNNING")
                status = "Running";
            else if (status_class == "STOPPED")
                status = "Not running";

            services.push({ name: name, unit: unit,
                            status: status, status_class: status_class });
            if (m[2] != "STOPPED")
                stopped = false;
        }
    });

    return {
        stopped: stopped,
        services: services,
        config: config
    };
}

class ServiceStatus extends React.Component {
    render() {
        var status = this.props.status;
        return (
            <div>
                <p>The FreeIPA web interface can be accessed at <a href={"https://" + status.config.host + "/ipa/ui"}>
                    https://{status.config.host}/ipa/ui</a>
                </p>
                <h3>Services</h3>
                <table className="service-status-table">
                    { status.services.map(s => (
                          <tr>
                              <td>
                                  <a onClick={utils.left_click(() => {
                                      cockpit.jump("system/services#/" + encodeURIComponent(s.unit));
                                      })}>
                                      {s.name}
                                  </a>
                              </td>
                              <td className={s.status_class}>{s.status}</td>
                          </tr>
                      ))
                    }
                </table>
            </div>
        );
    }
}

class Status extends React.Component {
    constructor() {
        super();
        this.state = { status: null, action: null };
    }

    componentDidMount() {
        this.update_status();
    }

    update_status() {
        this.setState({ status: { running: true } });
        cockpit.spawn([ "ipactl", "status" ], { superuser: true, err: "message" })
               .done(output => {
                   cockpit.file("/etc/ipa/default.conf").read().done(config => {
                       this.setState({ status: parse_ipactl_status(output, config) });
                   });
               })
               .fail((error) => {
                   if (error.exit_status == 4) {
                       this.setState({ status: { needs_config: true } });
                   } else {
                       this.setState({ status: { failure: error.message } });
                   }
               });
    }

    start() {
        this.setState({ action: { running: true,
                                  title: "Starting" } });
        cockpit.spawn([ "ipactl", "start" ], { superuser: true, err: "message" })
               .done(() => {
                   this.setState({ action: { } });
                   this.update_status();
               })
               .fail((error) => {
                   this.setState({ action: { } });
                   utils.show_error(error.message);
                   this.update_status();
               });
    }

    stop() {
        this.setState({ action: { running: true,
                                  title: "Stopping" } });
        cockpit.spawn([ "ipactl", "stop" ], { superuser: true, err: "message" })
               .done(() => {
                   this.setState({ action: { } });
                   this.update_status();
               })
               .fail((error) => {
                   this.setState({ action: { } });
                   utils.show_error(error.message);
                   this.update_status();
               });
    }

    render() {
        var self = this;

        // XXX - hard coded
        // XXX - just use samba-ad-ldap?
        var ports = [ "http", "https", "ldap", "ldaps", "kerberos", "kpasswd", "ntp" ];

        var status = this.state.status;

        if (!status || status.running)
            return <div className="spinner spinner-lg status-spinner"/>;

        var status_text;
        var status_button;
        if (status.failure) {
            status_text = (
                <span>There was an error while checking the status. 
                  <a onClick={utils.left_click(() => utils.show_error(status.failure))}>More..</a>
                </span>
            );
            status_button = null;
        } else if (this.state.action && this.state.action.running) {
            status_text = null;
            status_button = (
                <div className="spinner"/>
            );
        } else if (status.stopped) {
            status_text = "Stopped";
            status_button = (
                <button className="btn btn-default"
                        onClick={utils.left_click(() => { this.start(); })}>
                    Start
                </button>
            );
        } else {
            status_text = "Running";
            status_button = (
                <button className="btn btn-default"
                        onClick={utils.left_click(() => { this.stop(); })}>
                    Stop
                </button>
            );
        }

        return (
            <div>
                <table className="table header">
                    <tbody>
                        <tr>
                            <td><img src="logo.png"/></td>
                            <td>FreeIPA</td>
                            <td>{status_text}</td>
                            { status_button? <td>{status_button}</td> : null }
                        </tr>
                    </tbody>
                </table>
                <div>
                    <div className="pull-right">
                        <FirewallPorts ports={ports}/>
                    </div>
                    <ServiceStatus status={status}/>
                </div>
            </div>
        );
    }
}

module.exports = {
    Status: Status,
};
