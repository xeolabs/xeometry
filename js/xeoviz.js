function xeoviz(cfg) {

    var scene = new xeogl.Scene({transparent: true});
    var input = scene.input;
    var math = xeogl.math;
    var camera = scene.camera;
    var view = camera.view;

    var self = this;
    var models = {};
    var objects = {};
    var flying = true;
    var yspin = 0;
    var xspin = 0;

    var onTick = scene.on("tick", function () {
        if (yspin > 0) {
            view.rotateEyeY(yspin);
        }
        if (xspin > 0) {
            view.rotateEyeX(xspin);
        }
    });

    var cameraFlight = new xeogl.CameraFlightAnimation(scene, {
        fitFOV: 45,
        duration: 1
    });

    var cameraControl = new xeogl.CameraControl(scene);

    this.load = function (id, src, ok) {
        var model = models[id];
        if (model) {
            if (src === model.src) {
                if (ok) {
                    ok(model.id);
                }
                return;
            }
            this.unload(id);
        }
        model = new xeogl.GLTFModel(scene, {
            id: id,
            src: src,
            transform: new xeogl.Scale(scene, {
                parent: new xeogl.Quaternion(scene, {
                    parent: new xeogl.Translate(scene)
                })
            })
        });
        models[model.id] = model;
        model.on("loaded", function () {
            var entities = model.types["xeogl.Entity"];
            var object;
            for (var id in entities) {
                if (entities.hasOwnProperty(id)) {
                    object = entities[id];
                    model.add(object.material = object.material.clone());
                    objects[id] = object;
                }
            }
            if (ok) {
                ok(model.id);
            }
        });
    };

    this.models = function () {
        return Object.keys(models);
    };

    this.unload = function (id) {
        var model = models[id];
        if (!model) {
            error("Model not found: " + id);
            return;
        }
        var entities = model.types["xeogl.Entity"];
        for (var entityId in entities) {
            if (entities.hasOwnProperty(entityId)) {
                delete objects[entityId];
            }
        }
        model.destroy();
        delete models[id];
    };

    this.clear = function () {
        for (var id in models) {
            if (models.hasOwnProperty(id)) {
                this.unload(id);
            }
        }
    };

    this.scale = function (id, scale) {
        var component = getComponent(id);
        if (!component) {
            error("Model or object not found: " + id);
            return;
        }
        if (arguments.length === 1) {
            return component.transform.xyz.slice();
        } else {
            component.transform.xyz = scale;
        }
    };

    this.rotate = (function () {
        var quat = math.vec4();
        return function (id, angles) {
            var component = getComponent(id);
            if (!component) {
                error("Model or object not found: " + id);
                return;
            }
            if (arguments.length === 1) {
                return [0, 0, 0];
                //return component.transform.parent.xyzw.slice(); // TODO: should be angles
            } else {
                math.eulerToQuaternion(angles, "XYZ", quat); // Tait-Bryan Euler angles
                component.transform.parent.xyzw = quat;
            }
        };
    })();

    this.translate = function (id, pos) {
        var component = getComponent(id);
        if (!component) {
            error("Model or object not found: " + id);
            return;
        }
        if (arguments.length === 1) {
            return component.transform.parent.parent.xyz.slice();
        } else {
            component.transform.parent.parent.xyz = pos;
        }
    };

    this.show = function (ids) {
        setVisible(ids, true);
    };

    this.hide = function (ids) {
        setVisible(ids, false);
    };

    function setVisible(ids, visible) {
        if (ids === undefined || ids === null) {
            setVisible(self.objects(), visible);
            return;
        }
        if (xeogl._isString(ids)) {
            var id = ids;
            var component = objects[id];
            if (component) {
                component.visibility.visible = visible;
                return;
            }
            component = models[id];
            if (!component) {
                error("Model or object not found: " + id);
                return;
            }
            setVisible(self.objects(id), visible);
        } else {
            for (var i = 0, len = ids.length; i < len; i++) {
                setVisible(ids[i], visible);
            }
        }
    }

    this.objects = function (id) {
        if (id !== undefined) {
            var model = models[id];
            if (!model) {
                error("Model not found: " + id);
                return [];
            }
            var entities = model.types["xeogl.Entity"];
            if (!entities) {
                return [];
            }
            return Object.keys(entities);
        }
        return Object.keys(objects);
    };

    this.aabb = function (target) {
        if (arguments.length === 0 || target === undefined) {
            return scene.worldBoundary.aabb;
        }
        if (xeogl._isArray(target) && (!xeogl._isString(target[0]))) {
            return target; // AABB
        }
        if (xeogl._isString(target)) {
            target = [target];
        }
        if (target.length === 0) {
            return scene.worldBoundary.aabb;
        }
        var id;
        var component;
        var worldBoundary;
        if (target.length === 1) {
            id = target[0];
            component = scene.components[id];
            if (component) {
                worldBoundary = component.worldBoundary;
                if (worldBoundary) {
                    return worldBoundary.aabb;
                } else {
                    return null;
                }
            } else {
                return null;
            }
        }
        // Many ids given
        var i;
        var len;
        var xmin = 100000;
        var ymin = 100000;
        var zmin = 100000;
        var xmax = -100000;
        var ymax = -100000;
        var zmax = -100000;
        var aabb;
        var valid = false;
        for (i = 0, len = target.length; i < len; i++) {
            id = target[i];
            component = scene.components[id];
            if (!component) {
                component = models[id];
                if (!component) {
                    continue;
                }
            }
            worldBoundary = component.worldBoundary;
            if (!worldBoundary) {
                continue;
            }
            aabb = worldBoundary.aabb;
            if (aabb[0] < xmin) {
                xmin = aabb[0];
            }
            if (aabb[1] < ymin) {
                ymin = aabb[1];
            }
            if (aabb[2] < zmin) {
                zmin = aabb[2];
            }
            if (aabb[3] > xmax) {
                xmax = aabb[3];
            }
            if (aabb[4] > ymax) {
                ymax = aabb[4];
            }
            if (aabb[5] > zmax) {
                zmax = aabb[5];
            }
            valid = true;
        }
        if (valid) {
            var aabb2 = new math.AABB3();
            aabb2[0] = xmin;
            aabb2[1] = ymin;
            aabb2[2] = zmin;
            aabb2[3] = xmax;
            aabb2[1 + 3] = ymax;
            aabb2[2 + 3] = zmax;
            return aabb2;
        } else {
            return scene.worldBoundary.aabb;
        }
    };

    this.flying = function (value) {
        return (arguments.length === 0) ? flying : flying = !!value;
    };

    this.flightDuration = function (value) {
        return (arguments.length === 0) ? cameraFlight.duration : cameraFlight.duration = value;
    };

    this.fitFOV = function (value) {
        return (arguments.length === 0) ? cameraFlight.fitFOV : cameraFlight.fitFOV = value;
    };

    this.eye = function (eye) {
        if (eye) {
            view.eye = eye;
        } else {
            return view.eye;
        }
    };

    this.look = function (look) {
        if (look) {
            view.look = look;
        } else {
            return view.look;
        }
    };

    this.up = function (up) {
        if (up) {
            view.up = up;
        } else {
            return view.up;
        }
    };

    this.lookat = function (eye, look, up) {
        view.eye = eye;
        view.look = look;
        view.up = up || [0, 1, 0];
    };

    this.goto = function (target, ok) {
        (flying || ok) ? cameraFlight.flyTo({aabb: this.aabb(target)}, ok) : cameraFlight.jumpTo({aabb: this.aabb(target)});
    };

    this.right = function (target, ok) {
        gotoAxis(target, 0, ok);
    };

    this.back = function (target, ok) {
        gotoAxis(target, 1, ok);
    };

    this.left = function (target, ok) {
        gotoAxis(target, 2, ok);
    };

    this.front = function (target, ok) {
        gotoAxis(target, 3, ok);
    };

    this.top = function (target, ok) {
        gotoAxis(target, 4, ok);
    };

    this.bottom = function (target, ok) {
        gotoAxis(target, 5, ok);
    };

    var gotoAxis = (function () {
        var center = new math.vec3();
        return function (target, axis, ok) {
            var aabb = self.aabb(target);
            var diag = xeogl.math.getAABB3Diag(aabb);
            center[0] = aabb[0] + aabb[3] / 2.0;
            center[1] = aabb[1] + aabb[4] / 2.0;
            center[2] = aabb[2] + aabb[5] / 2.0;
            var dist = Math.abs((diag) / Math.tan(cameraFlight.fitFOV / 2));
            var cameraTarget;
            switch (axis) {
                case 0: // Right view
                    cameraTarget = {
                        look: center,
                        eye: [center[0] - dist, center[1], center[2]],
                        up: [0, 1, 0]
                    };
                    break;
                case 1: // Back view
                    cameraTarget = {
                        look: center,
                        eye: [center[0], center[1], center[2] + dist],
                        up: [0, 1, 0]
                    };
                    break;
                case 2: // Left view
                    cameraTarget = {
                        look: center,
                        eye: [center[0] + dist, center[1], center[2]],
                        up: [0, 1, 0]
                    };
                    break;
                case 3: // Front view
                    cameraTarget = {
                        look: center,
                        eye: [center[0], center[1], center[2] - dist],
                        up: [0, 1, 0]
                    };
                    break;
                case 4: // Top view
                    cameraTarget = {
                        look: center,
                        eye: [center[0], center[1] - dist, center[2]],
                        up: [0, 0, -1]
                    };
                    break;
                case 5: // Bottom view
                    cameraTarget = {
                        look: center,
                        eye: [center[0], center[1] + dist, center[2]],
                        up: [0, 0, 1]
                    };
                    break;
            }
            if (flying || ok) {
                cameraFlight.flyTo(cameraTarget, ok);
            } else {
                cameraFlight.jumpTo(cameraTarget);
            }
        };
    })();

    this.zoom = function (zoom) {
        view.zoom(zoom);
    };

    this.yspin = function (value) {
        return (arguments.length === 0) ? yspin : yspin = value;
    };

    this.xspin = function (value) {
        return (arguments.length === 0) ? xspin : xspin = value;
    };

    this.state = function (state) {
        if (state) {
            var self = this;
            load(state.models, 0, function () {
                self.hide();
                self.show(state.visible);
                self.lookat(state.lookat.eye, state.lookat.look, state.lookat.up);
            });
        } else {
            state = {};
            var id;
            var model;
            var vecToArray = xeogl.math.vecToArray;
            state.models = [];
            for (var modelId in models) {
                if (models.hasOwnProperty(modelId)) {
                    model = models[modelId];
                    state.models.push({
                        id: model.id,
                        src: model.src,
                        translate: vecToArray(this.translate(modelId)),
                        scale: vecToArray(this.scale(modelId)),
                        rotate: vecToArray(this.rotate(modelId))
                    });
                }
            }
            state.visible = [];
            for (id in objects) {
                if (objects.hasOwnProperty(id)) {
                    if (objects[id].visibility.visible) {
                        state.visible.push(id);
                    }
                }
            }
            state.lookat = {
                eye: vecToArray(view.eye),
                look: vecToArray(view.look),
                up: vecToArray(view.up)
            };
            return state;
        }
    };

    function load(_modelsData, i, ok) {
        if (i >= _modelsData.length) {
            ok();
            return;
        }
        var modelData = _modelsData[i];
        var id = modelData.id;
        self.load(id, modelData.src, function () {
            self.translate(id, modelData.translate);
            self.scale(id, modelData.scale);
            self.rotate(id, modelData.rotate);
            load(_modelsData, i + 1, ok);
        });
    }

    this.destroy = function () {
        scene.off(onTick);
        scene.destroy();
        models = {};
        objects = {};
    };

    function getComponent(id) {
        var component = objects[id];
        if (!component) {
            component = models[id];
        }
        return component;
    }

    function error(msg) {
        console.log(msg);
    }

    if (cfg) {
        this.state(cfg);
    }
}