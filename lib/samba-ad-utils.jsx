import dialog from "cockpit-components-dialog.jsx"
import setup_dialog from "samba-ad-setup.jsx"

/* UTILITIES */

function left_click(parameter, fun, funp) {
    return function (event) {
        if (!event || event.button !== 0)
            return;
        event.stopPropagation();
        return fun(parameter, funp, event);
    };
}

function show_error(text) {
    dialog.show_modal_dialog(
        {
            title: "Error",
            body: (
                <div className="modal-body">
                    <p>{text}</p>
                </div>
            )
        },
        {
            cancel_caption: "Close",
            actions: [ ]
        });
}

module.exports = {
    left_click: left_click,
    show_error: show_error,
};




