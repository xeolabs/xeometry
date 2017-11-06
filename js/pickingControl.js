/**
 Mouse picking control.

 @param viewer
 @param cfg
 @constructor
 */
xeometry.PickingControl = function (viewer, cfg) {

    var self = this;

    cfg = cfg || {};

    var overlay = viewer.getOverlay();

    overlay.oncontextmenu = function (e) {
        e.preventDefault();
    };

    var mousePos = [0, 0];
    var needPick = false;
    var pickedObjectId;

    function pick() {
        if (!needPick) {
            return;
        }
        var hit = viewer.pickObject(mousePos);
        if (hit) {
            if (pickedObjectId !== hit.id) {
                if (pickedObjectId !== undefined) {
                    self.fire("hoverout", pickedObjectId);
                }
                self.fire("hover", hit.id);
                pickedObjectId = hit.id;
            }
        } else {
            if (pickedObjectId !== undefined) {
                self.fire("hoverout", pickedObjectId);
                pickedObjectId = undefined;
            }
        }
        needPick = false;
    }

    var tick = function () {
        pick();
        requestAnimationFrame(tick);
    };

    tick();

    overlay.addEventListener("mousemove", function (e) {
        getCoordsWithinElement(e, mousePos);
        needPick = true;
    });

    overlay.addEventListener('click', (function (e) {
        var clicks = 0;
        var timeout;
        return function (e) {
            if (!eventSubs["doubleclicked"] && !eventSubs["nothingdoubleclicked"]) {
                //  Avoid the single/double click differentiation timeout
                pick();
                if (pickedObjectId) {
                    self.fire("clicked", pickedObjectId);
                } else {
                    self.fire("nothingclicked");
                }
                return;
            }
            clicks++;
            if (clicks == 1) {
                timeout = setTimeout(function () {
                    pick();
                    if (pickedObjectId) {
                        self.fire("clicked", pickedObjectId);
                    } else {
                        self.fire("nothingclicked");
                    }
                    clicks = 0;
                }, 250);
            } else {
                clearTimeout(timeout);
                pick();
                if (pickedObjectId) {
                    self.fire("doubleclicked", pickedObjectId);
                } else {
                    self.fire("nothingdoubleclicked");
                }
                clicks = 0;
            }
        };
    })(), false);

    function getCoordsWithinElement(event, coords) {
        if (!event) {
            event = window.event;
            coords[0] = event.x;
            coords[1] = event.y;
        }
        else {
            var element = event.target;
            var totalOffsetLeft = 0;
            var totalOffsetTop = 0;

            while (element.offsetParent) {
                totalOffsetLeft += element.offsetLeft;
                totalOffsetTop += element.offsetTop;
                element = element.offsetParent;
            }
            coords[0] = event.pageX - totalOffsetLeft;
            coords[1] = event.pageY - totalOffsetTop;
        }
    }

    var eventSubs = {};

    /**
     * Subscribes to an event on this BIMPickingControl.
     * @method on
     * @param {String} event The event
     * @param {Function} callback Called fired on the event
     */
    this.on = function (event, callback) {
        var subs = eventSubs[event];
        if (!subs) {
            subs = [];
            eventSubs[event] = subs;
        }
        subs.push(callback);
    };

    /**
     * Fires an event on this BIMPickingControl.
     * @method fire
     * @param {String} event The event type name
     * @param {Object} value The event parameters
     */
    this.fire = function (event, value) {
        var subs = eventSubs[event];
        if (subs) {
            for (var i = 0, len = subs.length; i < len; i++) {
                subs[i](value);
            }
        }
    };
};
