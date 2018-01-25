import React from "react";
import $ from "jquery";

import cockpit from "cockpit";
import utils from "samba-ad-utils.jsx"
import Status from "samba-ad-status.jsx"
import setup from "samba-ad-setup.jsx"

function show_setup(element, self, event) {
        setup.setup_dialog(element, () => {
            self.update_status();
        });
}

var initial_screen = {
    initial_dc: {
        description: "Samba AD domain controller needs to be setup before it could be used",
        label: "Setup Samba AD domain controller",
        action_label: "Run initial Samba AD setup",
	setup_type: 'dc',
    },
    install_client: {
        description: "This machine is not enrolled to Samba AD. It can be enrolled into an existing environment as a client.",
        label: "Enroll a client to a domain",
        action_label: "Run initial client setup",
	setup_type: 'client',
    },
    promote_dc: {
        description: "If you have existing Samba AD environment, this machine can be provisioned as a member server.",
        label: "Setup a member server",
        action_label: "Setup a member server",
	setup_type: 'member',
    },
};

class InitialStatus extends React.Component {
    constructor() {
        super();
        this.state = { status: null, action: null };
    }

    componentDidMount() {
        this.update_status();
    }

    update_status() {
        this.setState({ status: { running: true } });
        cockpit.spawn([ "/usr/libexec/cockpit-app-samba-ad-check-install" ],
                      { superuser: null, err: "message" })
            .done(output => {
                var state = JSON.parse(output);
                switch (state.result) {
                case 'NOT_CONFIGURED':
                    this.setState({ 
                        status: { running: false,
                                  needs_config: true,
                                  initial_dc: true,
                                  install_client: true,
                                  promote_dc: true }
                    });
                break;
                case 'CLIENT_CONFIGURED':
                    this.setState({
                        status: { running: false,
                                  needs_config: true,
                                  initial_dc: false,
                                  install_client: false,
                                  promote_dc: true}
                    });
                break;
                case 'SERVER_CONFIGURED':
                    this.setState({
                        status: { running: false, needs_config: false }
                    });
                break;
                }
            })
            .fail((error) => {
                if (error.exit_status == -127) {
                    this.setState({
                        status: { running: false,
                                  needs_config: true,
                                  initial_dc: true,
                                  install_client: true,
                                  promote_dc: true }
                    });
                } else {
                    this.setState({ status: { failure: error.message } });
                }
            });
    }

    render() {
        var self = this;
        var status = this.state.status;

        function InitialScreenElement(props) {
            const element = props.element.element;
            if (props.element.enabled)
                return (
                    <div className="setup-message">
                        <p>{element.description}</p>
                        <p><button className="btn btn-primary"
                                   onClick={utils.left_click({label: element.label, setup_type: element.setup_type}, show_setup, self)}>
                            {element.action_label}
                        </button></p>
                    </div>
                );
            return null;
        }

        if (!status || status.running)
            return <div className="spinner spinner-lg status-spinner"/>;

        if (status.needs_config) {
            var n = [ {enabled: status.initial_dc, element: initial_screen.initial_dc},
                      {enabled: status.promote_dc, element: initial_screen.promote_dc},
                      {enabled: status.install_client, element: initial_screen.install_client},
                    ];
            return (
                <center className="setup-message">
                    <p><img src="logo-big.png"/></p>
                    {n.map((element) =>
                        <InitialScreenElement element={element} />
                    )}
                </center>
            );
        } else {
            return (
                <center className="setup-message">
                    <p><img src="logo-big.png"/></p>
                    <p>This machine is a Samba AD domain controller.</p>
                    <div className="container-fluid">
                        <Status.Status/>
                    </div>
                </center>
            );
        }
    }
}

module.exports = {
    InitialStatus: InitialStatus,
};
