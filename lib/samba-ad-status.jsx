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

function parse_samba_tool_domain_info(text) {
    var env_re = /^(.+):(.+)$/;
    var env = [ ];

    text.split("\n").forEach(l => {
        var m = env_re.exec(l);
        if (m) {
            var name = m[1];
	    var value = m[2];
            env.push({ name: name,
                       value: value });
        }
    });

    return {
        variable: env,
    };
}

class SambaStatus extends React.Component {
    render() {
        var status = this.props.status;
        return (
            <div>
                <h3>Samba AD configuration</h3>
                <table className="variable-status-table">
                    { status.variable.map(s => (
                          <tr>
                              <td className="variable-status-name">
                                      {s.name}
                              </td>
                              <td className="variable-status-value">{s.value}</td>
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
        cockpit.spawn([ "samba-tool", "domain", "info", "127.0.0.1" ], { superuser: true, err: "message" })
               .done(output => {
                       this.setState({ status: parse_samba_tool_domain_info(output) });
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
        cockpit.spawn([ "systemctl", "start", "samba" ], { superuser: true, err: "message" })
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
        cockpit.spawn([ "systemctl", "stop", "samba" ], { superuser: true, err: "message" })
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
        var ports = [ "ldap", "ldaps", "kerberos", "kpasswd", "samba", "samba-client" ];

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
                            <td>Samba AD</td>
                            <td>{status_text}</td>
                            { status_button? <td>{status_button}</td> : null }
                        </tr>
                    </tbody>
                </table>
                <div>
                    <div className="pull-right">
                        <FirewallPorts ports={ports}/>
                    </div>
                    <SambaStatus status={status}/>
                </div>
            </div>
        );
    }
}

module.exports = {
    Status: Status,
};
