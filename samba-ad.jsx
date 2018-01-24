import React from "react";
import $ from "jquery";

import cockpit from "cockpit";
import dialog from "cockpit-components-dialog.jsx"
import OnOff from "cockpit-components-onoff.jsx"

import "./samba-ad.css";
import "table.css";

import InitialStatus from "samba-ad-initial-screen.jsx";

/* MAIN */

class App extends React.Component {
    render() {
        return (
            <div className="container-fluid">
                <InitialStatus.InitialStatus/>
            </div>
        );
    }
}

$(function () {
    React.render(<App/>, $('#app')[0]);
    $('body').show();
});
