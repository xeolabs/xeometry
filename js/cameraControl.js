/**
 * Controls the camera of a xeometry.Viewer with the mouse.
 *
 * This is xeometry's bundled, default camera control.
 *
 * @class CameraControl
 * @param {Viewer} viewer A Viewer.
 * @param {Object} [cfg] Configs
 * @example
 *
 * var viewer = new xeometry.Viewer();
 *
 * var cameraControl = new xeometry.CameraControl(viewer);
 */
xeometry.CameraControl = function (viewer, cfg) {

    cfg = cfg || {};

    var firstPerson = !!cfg.firstPerson;
    var mouseOrbitSens = cfg.mouseOrbitSens || 1.0;
    var mousePanSens = cfg.mousePanSens || 0.1;
    var mouseZoomSens = cfg.mouseZoomSens || 1.0;

    var canvas = viewer.getOverlay();

    canvas.oncontextmenu = function (e) {
        e.preventDefault();
    };

    // Mouse orbit

    (function () {

        var lastX;
        var lastY;
        var xDelta = 0;
        var yDelta = 0;
        var down = false;
        var over = false;
        var angle;

        canvas.addEventListener("mousedown", function (e) {
            if (!over) {
                return;
            }
            if (e.which === 1) {// Left button
                down = true;
                xDelta = 0;
                yDelta = 0;
                lastX = e.clientX;
                lastY = e.clientY;
            }
            //e.preventDefault();
        });

        canvas.addEventListener("mouseup", function () {
            down = false;
            xDelta = 0;
            yDelta = 0;
        });

        canvas.addEventListener("mouseenter", function () {
            over = true;
            xDelta = 0;
            yDelta = 0;
        });

        canvas.addEventListener("mouseleave", function () {
            over = false;
            xDelta = 0;
            yDelta = 0;
        });

        canvas.addEventListener("mousemove", function (e) {
            if (!over) {
                return;
            }
            if (!down) {
                return;
            }
            var x = e.clientX;
            var y = e.clientY;
            var scaleSens = 0.5;
            var xDelta = (x - lastX) * scaleSens * mouseOrbitSens;
            var yDelta = (y - lastY) * scaleSens *mouseOrbitSens;
            lastX = x;
            lastY = y;
            if (xDelta !== 0) {
                angle = -xDelta * mouseOrbitSens;
                if (firstPerson) {
                    viewer.rotateLookY(angle);
                } else {
                    viewer.rotateEyeY(angle);
                }
            }
            if (yDelta !== 0) {
                angle = yDelta * mouseOrbitSens;
                if (firstPerson) {
                    viewer.rotateLookX(-angle);
                } else {
                    viewer.rotateEyeX(angle);
                }
            }
        });

    })();

    // Mouse pan

    (function () {

        var lastX;
        var lastY;
        var xDelta = 0;
        var yDelta = 0;
        var down = false;
        var over = false;
        var angle;

        canvas.addEventListener("mousedown", function (e) {
            if (!over) {
                return;
            }
            if (e.which === 3) {// Right button
                down = true;
                xDelta = 0;
                yDelta = 0;
                lastX = e.clientX;
                lastY = e.clientY;
                e.preventDefault();
            }
        });

        canvas.addEventListener("mouseup", function () {
            down = false;
            xDelta = 0;
            yDelta = 0;
        });

        canvas.addEventListener("mouseenter", function () {
            over = true;
            xDelta = 0;
            yDelta = 0;
        });

        canvas.addEventListener("mouseleave", function () {
            over = false;
            xDelta = 0;
            yDelta = 0;
        });

        canvas.addEventListener("mousemove", function (e) {
            if (!over) {
                return;
            }
            if (!down) {
                return;
            }
            var x = e.clientX;
            var y = e.clientY;
            var xDelta = (x - lastX) * mousePanSens;
            var yDelta = (y - lastY) * mousePanSens;
            lastX = x;
            lastY = y;
            if (xDelta !== 0 || yDelta !== 0) {
                viewer.pan([xDelta, yDelta, 0]);
            }
        });

    })();

    // Mouse wheel zoom

    (function () {

        var delta = 0;
        var target = 0;
        var newTarget = false;
        var targeting = false;
        var progress = 0;

        var eyeVec = new Float32Array(3);
        var lookVec = new Float32Array(3);
        var tempVec3 = new Float32Array(3);

        function dotVec3(u, v) {
            return (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]);
        }

        function sqLenVec3(v) {
            return dotVec3(v, v);
        }

        function lenVec3(v) {
            return Math.sqrt(sqLenVec3(v));
        }

        function subVec3(u, v, dest) {
            if (!dest) {
                dest = u;
            }
            dest[0] = u[0] - v[0];
            dest[1] = u[1] - v[1];
            dest[2] = u[2] - v[2];
            return dest;
        }

        canvas.addEventListener("wheel", function (e) {
            delta = Math.max(-1, Math.min(1, -e.deltaY * 40));
            if (delta === 0) {
                targeting = false;
                newTarget = false;
            } else {
                newTarget = true;
            }
        });

        var tick = function () {

            var eye = viewer.getEye();
            var look = viewer.getLook();

            eyeVec[0] = eye[0];
            eyeVec[1] = eye[1];
            eyeVec[2] = eye[2];

            lookVec[0] = look[0];
            lookVec[1] = look[1];
            lookVec[2] = look[2];

            subVec3(eyeVec, lookVec, tempVec3);

            var lenLook = Math.abs(lenVec3(tempVec3));
            var lenLimits = 1000;
            var f = mouseZoomSens * (2.0 + (lenLook / lenLimits));

            if (newTarget) {
                target = delta * f;
                progress = 0;
                newTarget = false;
                targeting = true;
            }

            if (targeting) {

                if (delta > 0) {

                    progress += 0.2 * f;

                    if (progress > target) {
                        targeting = false;
                    }

                } else if (delta < 0) {

                    progress -= 0.2 * f;

                    if (progress < target) {
                        targeting = false;
                    }
                }

                if (targeting) {
                    viewer.zoom(progress);
                }
            }

            requestAnimationFrame(tick);
        };

        tick();

    })();

    // Mouse picking

    (function () {

        var downX;
        var downY;

        canvas.addEventListener("mousedown", function (e) {
            if (e.which !== 1) {// Left button
                return;
            }
            downX = e.clientX;
            downY = e.clientY;
        });

        canvas.addEventListener("mouseup", function (e) {
            if (e.which !== 1) {// Left button
                return;
            }
            if (Math.abs(e.clientX - downX) > 3 || Math.abs(e.clientY - downY) > 3) {
                return;
            }
            var canvasPos = getCoordsWithinElement(e);
            var hit = viewer.pickSurface(canvasPos);
            if (hit) {
                var vfd = viewer.getViewFitDuration();
               // viewer.setViewFitDuration(1.0);
                viewer.viewFit(hit.id);
          //      viewer.setViewFitDuration(vfd);
               // alert(JSON.stringify(hit, null, "\t"));
                e.preventDefault();
            }
        });

    })(this);

    function getCoordsWithinElement(event) {
        var coords = [0, 0];
        if (!event) {
            event = window.event;
            coords.x = event.x;
            coords.y = event.y;
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
        return coords;
    }
};
