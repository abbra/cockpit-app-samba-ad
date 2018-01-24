var cockpit = require("cockpit");
var React = require("react");

import $ from "jquery";
import dialog from "cockpit-components-dialog.jsx"
import OnOff from "cockpit-components-onoff.jsx"

/* SETUP */

function setup(options, progress_cb) {
    var outbuf = "";
    var cur_title, cur_perc, progress;
    var perc_re = /^ {2}\[(\d+)\/(\d+)\]/;

    function parse_progress(data) {
        outbuf += data;
        var lines = outbuf.split("\n");
        for (var i = 0; i < lines.length-1; i++) {
            var m = perc_re.exec(lines[i]);
            if (m) {
                cur_perc = parseInt(m[1])/parseInt(m[2]) * 100;
            } else {
                cur_title = lines[i];
            }
        }
        if (cur_title) {
            progress = cur_title;
            if (cur_perc)
                progress += " / " + cur_perc.toFixed(0) + "%";
            progress_cb(progress);
        }
        outbuf = lines[lines.length-1];
    }

    var promise = cockpit.spawn([ "ipa-server-install",
                                  "-U",
                                  "-r", options.realm,
                                  "-p", options.dirmanpw,
                                  "-a", options.adminpw ],
                                { superuser: true,
                                  err: "message"
                                });

    promise.stream(parse_progress);
    promise.cancel = () => {
        console.log("cancelling");
        promise.close("terminated");
    };

    return promise;
}

class Validated extends React.Component {
    render() {
        var error = this.props.errors && this.props.errors[this.props.error_key];
        // We need to always render the <div> for the has-error
        // class so that the input field keeps the focus when
        // errors are cleared.  Otherwise the DOM changes enough
        // for the Browser to remove focus.
        return (
            <div className={error? "has-error" : ""}>
                {this.props.children}
                {error? <span className="help-block">{error}</span> : null}
            </div>
        );
    }
}

class SetupBody extends React.Component {
    render() {
        var props = this.props;

        function input_box(field, type) {
            return (
                <Validated errors={props.errors} error_key={field}>
                    <input className="form-control" type={type}
                           value={props.values[field]}
                           onChange={
                               (event) => {
                                   props.values[field] = event.target.value;
                                   props.onchanged();
                               }}/>
                </Validated>
            );
        }

        function dialog_row(title, field, type) {
            return (
                <tr>
                    <td className="top">
                        <label className="control-label">{title}</label>
                    </td>
                    <td>
                        { input_box(field, type) }
                    </td>
                </tr>
            );
        }

        return (
            <div className="modal-body">
                <table className="form-table-ct">
                    { dialog_row("Realm", 'realm', 'text') }
                    { dialog_row("Directory Manager password", 'dirmanpw', 'password') }
                    { dialog_row("Confirm Directory Manager password", 'dirmanpw2', 'password') }
                    { dialog_row("Admin password", 'adminpw', 'password') }
                    { dialog_row("Confirm Admin password", 'adminpw2', 'password') }
                </table>
            </div>
        );
    }
}

function setup_dialog(element, done_callback) {
    var dlg;

    var errors = null;
    var values = {
        realm: "",
        dirmanpw: "",
        dirmanpw2: "",
        adminpw: "",
        adminpw2: ""
    };

    function onchanged() {
        if (errors) {
            errors = null;
            update();
        }
    }

    function body_props() {
        return {
            title: element.label,
            body: <SetupBody values={values}
                             errors={errors}
                             onchanged={onchanged}/>
        };
    }

    function update() {
        dlg.setProps(body_props());
    }

    function validate() {
        errors = { };

        if (!values.realm)
            errors.realm = "Realm can't be empty";

        function validate_password(field, field2) {
            if (!values[field])
                errors[field] = "Password can't be empty";
            if (values[field].length < 8)
                errors[field] = "Password must be at least 8 characters";
            if (values[field] && values[field2] != values[field])
                errors[field2] = "Passwords don't match";
        }

        validate_password('dirmanpw', 'dirmanpw2');
        validate_password('adminpw', 'adminpw2');

        if (Object.keys(errors).length === 0)
            errors = null;

        update();
        return cockpit.resolve();
    }

    function apply(progress_cb) {
        var dfd = cockpit.defer();
        var promise = dfd.promise();

        var setup_promise;
        var cancelled = false;

        validate().
                   done(function () {
                       if (cancelled) {
                           cockpit.reject();
                       } else {
                           setup_promise = setup(values, progress_cb);
                           setup_promise.
                                         done(function () {
                                             dfd.resolve();
                                         }).
                                         fail(function (error) {
                                             dfd.reject(error);
                                         });
                       }

                   }).
                   fail(function(error) {
                       dfd.reject(error);
                   });

        promise.cancel = function() {
            if (setup_promise)
                setup_promise.close("terminated");
            cancelled = true;
        }

        return promise;
    }

    dlg = dialog.show_modal_dialog(
        body_props(),
        {
            actions: [ { 'clicked': apply,
                         'caption': element.label,
                         'style': 'primary' } ],
            dialog_done: done_callback
        }
    );
}

module.exports = {
    setup_dialog: setup_dialog,
};
