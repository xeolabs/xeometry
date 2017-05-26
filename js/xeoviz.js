function xeoviz(cfg) {

    var scene = new xeogl.Scene({transparent: true});
    var math = xeogl.math;
    var camera = scene.camera;
    var view = camera.view;

    var self = this;
    var types = {};
    var models = {};
    var objects = {};
    var eulerAngles = {};
    var objectModels = {};
    var flattened = {};
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

    this.loadModel = function (id, src, ok) {
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


        ////////////////////////////////////////////////
        // TODO: Pass in 'bakeTransforms' property to model constructor
        // cause loader to accumilate matrix instead of build transform tree for each object
        ////////////////////////////////////////////////

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
            var meta;
            for (var id in entities) {
                if (entities.hasOwnProperty(id)) {
                    object = entities[id];
                    model.add(object.material = object.material.clone());
                    objects[id] = object;
                    objectModels[id] = model;
                    // Register for IFC type
                    var type = meta && meta.type ? meta.type : "DEFAULT";
                    var objectsOfType = (types[type] || (types[type] = {}));
                    objectsOfType[id] = object;
                }
            }
            if (ok) {
                ok(model.id);
            }
        });
    };

    this.getModels = function () {
        return Object.keys(models);
    };

    this.getObjects = function (id) {
        if (id !== undefined || id === null) {
            var objectsOfType = types[id];
            if (objectsOfType) {
                return Object.keys(objectsOfType);
            }
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

    this.unloadModel = function (id) {
        var model = models[id];
        if (!model) {
            error("Model not found: " + id);
            return;
        }
        var entities = model.types["xeogl.Entity"];
        var entity;
        var meta;
        for (var entityId in entities) {
            if (entities.hasOwnProperty(entityId)) {
                entity = entities[entityId];
                // Deregister for IFC type
                meta = entity.meta;
                var type = meta && meta.type ? meta.type : "DEFAULT";
                var objectsOfType = types[type];
                if (objectsOfType) {
                    delete objectsOfType[entityId];
                }
                delete objects[entityId];
                delete objectModels[entityId];
                delete eulerAngles[entityId];
                delete flattened[entityId];
            }
        }
        model.destroy();
        delete models[id];
        delete eulerAngles[id];
    };

    this.clear = function () {
        for (var id in models) {
            if (models.hasOwnProperty(id)) {
                this.unload(id);
            }
        }
    };

    this.setType = function (id, type) {
        type = type || "DEFAULT";
        var object = objects[id];
        if (object) {
            var meta = object.meta;
            var currentType = meta && meta.type ? meta.type : "DEFAULT";
            if (currentType === type) {
                return;
            }
            var currentTypes = types[currentType];
            if (currentTypes) {
                delete currentTypes[id];
            }
            var newTypes = (types[type] || (types[type] = {}));
            newTypes[id] = object;
            object.meta.type = type;
            return;
        }
        var model = models[id];
        if (model) {
            //.. TODO
            return;
        }
        error("Model, object or type not found: " + id);
    };

    this.getType = function (id) {
        var object = objects[id];
        if (object) {
            var meta = object.meta;
            return meta && meta.type ? meta.type : "DEFAULT";
        }
        error("Model, object or type not found: " + id);
    };

    this.setScale = function (id, scale) {
        var component = getTransformableComponent(id);
        if (!component) {
            error("Model or object not found: " + id);
            return;
        }
        component.transform.xyz = scale;
    };

    this.getScale = function (id) {
        var component = getTransformableComponent(id);
        if (!component) {
            error("Model or object not found: " + id);
            return;
        }
        return component.transform.xyz.slice();
    };

    this.setRotate = (function () {
        var quat = math.vec4();
        return function (id, angles) {
            var component = getTransformableComponent(id);
            if (!component) {
                error("Model or object not found: " + id);
                return;
            }
            math.eulerToQuaternion(angles, "XYZ", quat); // Tait-Bryan Euler angles
            component.transform.parent.xyzw = quat;
            var saveAngles = eulerAngles[id] || (eulerAngles[id] = math.vec3());
            saveAngles.set(angles);
        };
    })();

    this.getRotate = function (id) {
        var component = getTransformableComponent(id);
        if (!component) {
            error("Model or object not found: " + id);
            return;
        }
        return eulerAngles[id] || math.vec3([0, 0, 0]);
    };

    this.setTranslate = function (id, translate) {
        var component = getTransformableComponent(id);
        if (!component) {
            error("Model or object not found: " + id);
            return;
        }
        component.transform.parent.parent.xyz = translate;
    };

    this.getTranslate = function (id) {
        var component = getTransformableComponent(id);
        if (!component) {
            error("Model or object not found: " + id);
            return;
        }
        return component.transform.parent.parent.xyz.slice();
    };

    this.show = function (ids) {
        setVisible(ids, true);
    };

    this.hide = function (ids) {
        setVisible(ids, false);
    };

    function setVisible(ids, visible) {
        if (ids === undefined || ids === null) {
            setVisible(self.getObjects(), visible);
            return;
        }
        if (xeogl._isString(ids)) {
            var id = ids;
            var object = objects[id];
            if (object) {
                object.visibility.visible = visible;
                return;
            }
            var model = models[id];
            if (!model) {
                var objectsOfType = types[id];
                if (objectsOfType) {
                    var typeIds = Object.keys(objectsOfType);
                    if (typeIds.length === 0) {
                        return;
                    }
                    setVisible(typeIds, visible);
                    return
                }
                error("Model, object or type not found: " + id);
                return;
            }
            setVisible(self.getObjects(id), visible);
            return;
        }
        for (var i = 0, len = ids.length; i < len; i++) {
            setVisible(ids[i], visible);
        }
    }

    this.getAABB = function (target) {
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
        var objectsOfType;
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
                objectsOfType = types[id];
                if (objectsOfType) {
                    return this.getAABB(Object.keys(objectsOfType));
                }
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
            }
            if (component) {
                worldBoundary = component.worldBoundary;
                if (!worldBoundary) {
                    continue;
                }
                aabb = worldBoundary.aabb;
            } else {
                objectsOfType = types[id];
                if (objectsOfType) {
                    var ids = Object.keys(objectsOfType);
                    if (ids.length === 0) {
                        continue;
                    }
                    aabb = this.getAABB(ids);
                } else {
                    continue;
                }
            }
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
    
    this.setEye = function (eye) {
        view.eye = eye;
    };

    this.getEye = function () {
        return view.eye;
    };

    this.setLook = function (look) {
        view.look = look;
    };

    this.getLook = function () {
        return view.look;
    };

    this.setUp = function (up) {
        view.up = up;
    };

    this.getUp = function () {
        return view.up;
    };

    this.setEyeLookUp = function (eye, look, up) {
        view.eye = eye;
        view.look = look;
        view.up = up || [0, 1, 0];
    };

    this.setViewFitSpeed = function (value) {
        cameraFlight.duration = value;
        flying = (value > 0);
    };

    this.getViewFitSpeed = function () {
        return cameraFlight.duration;
    };

    this.setViewFitFOV = function (value) {         
        cameraFlight.fitFOV = value;
    };

    this.getViewFitFOV = function () {
        return cameraFlight.fitFOV;
    };

    this.viewFit = function (target, ok) {
        (flying || ok) ? cameraFlight.flyTo({aabb: this.getAABB(target)}, ok) : cameraFlight.jumpTo({aabb: this.getAABB(target)});
    };

    this.viewFitRight = function (target, ok) {
        viewFitAxis(target, 0, ok);
    };

    this.viewFitBack = function (target, ok) {
        viewFitAxis(target, 1, ok);
    };

    this.viewFitLeft = function (target, ok) {
        viewFitAxis(target, 2, ok);
    };

    this.viewFitFront = function (target, ok) {
        viewFitAxis(target, 3, ok);
    };

    this.viewFitTop = function (target, ok) {
        viewFitAxis(target, 4, ok);
    };

    this.viewFitBottom = function (target, ok) {
        viewFitAxis(target, 5, ok);
    };

    var viewFitAxis = (function () {
        var center = new math.vec3();
        return function (target, axis, ok) {
            var aabb = self.getAABB(target);
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

    this.getBookmark = (function () {

        var vecToArray = xeogl.math.vecToArray;

        function getTranslate(component) {
            var translate = component.transform.parent.parent.xyz;
            if (translate[0] !== 0 || translate[1] !== 0 || translate[1] !== 0) {
                return vecToArray(translate);
            }
        }

        function getScale(component) {
            var scale = component.transform.xyz;
            if (scale[0] !== 1 || scale[1] !== 1 || scale[1] !== 1) {
                return vecToArray(scale);
            }
        }

        function getRotate(component) {
            var rotate = eulerAngles[component.id];
            if (rotate && (rotate[0] !== 0 || rotate[1] !== 0 || rotate[2] !== 0)) {
                return vecToArray(rotate);
            }
        }

        return function () {
            var bookmark = {};
            var id;
            var model;
            var modelData;
            var translate;
            var scale;
            var rotate;
            bookmark.models = [];
            for (var modelId in models) {
                if (models.hasOwnProperty(modelId)) {
                    model = models[modelId];
                    modelData = {
                        id: model.id,
                        src: model.src
                    };
                    translate = getTranslate(model);
                    if (translate) {
                        modelData.translate = translate;
                    }
                    scale = getScale(model);
                    if (scale) {
                        modelData.scale = scale;
                    }
                    rotate = getRotate(model);
                    if (rotate) {
                        modelData.rotate = rotate;
                    }
                    bookmark.models.push(modelData);
                }
            }
            bookmark.objects = {};
            for (id in objects) {
                var object;
                var objectData;
                if (objects.hasOwnProperty(id)) {
                    object = objects[id];
                    objectData = null;
                    translate = getTranslate(object);
                    if (translate) {
                        objectData = objectData || (bookmark.objects[id] = {});
                        objectData.translate = translate;
                    }
                    scale = getScale(object);
                    if (scale) {
                        objectData = objectData || (bookmark.objects[id] = {});
                        objectData.scale = scale;
                    }
                    rotate = getRotate(object);
                    if (rotate) {
                        objectData = objectData || (bookmark.objects[id] = {});
                        objectData.rotate = rotate;
                    }
                    if (object.visibility.visible) {
                        objectData = objectData || (bookmark.objects[id] = {});
                        objectData.visible = true;
                    } else if (objectData) {
                        objectData.visible = false;
                    }
                }
            }
            bookmark.lookat = {
                eye: vecToArray(view.eye),
                look: vecToArray(view.look),
                up: vecToArray(view.up)
            };
            return bookmark;
        };
    })();

    this.setBookmark = (function () {

        function loadModels(_modelsData, i, ok) {
            if (i >= _modelsData.length) {
                ok();
                return;
            }
            var modelData = _modelsData[i];
            var id = modelData.id;
            self.loadModel(id, modelData.src, function () {
                self.setTranslate(id, modelData.translate);
                self.setScale(id, modelData.scale);
                self.setRotate(id, modelData.rotate);
                loadModels(_modelsData, i + 1, ok);
            });
        }

        return function (bookmark) {
            loadModels(bookmark.models, 0, function () {
                var objectStates = bookmark.objects;
                var objectState;
                var visible = [];
                for (var id in objectStates) {
                    if (objectStates.hasOwnProperty(id)) {
                        objectState = objectStates[id];
                        if (objectState.visible) {
                            visible.push(id);
                        }
                        if (objectState.translate) {
                            self.setTranslate(id, objectState.translate);
                        }
                        if (objectState.scale) {
                            self.setScale(id, objectState.scale);
                        }
                        if (objectState.rotate) {
                            self.setRotate(id, objectState.rotate);
                        }
                    }
                }
                self.hide();
                self.show(visible);
                self.lookat(bookmark.lookat.eye, bookmark.lookat.look, bookmark.lookat.up);
            });
        };
    })();

    this.destroy = function () {
        scene.off(onTick);
        scene.destroy();
        models = {};
        objects = {};
        objectModels = {};
        eulerAngles = {};
        flattened = {};
    };

    function getTransformableComponent(id) {
        var component = getComponent(id);
        if (component && objects[id] && !flattened[id]) {
            flattenTransform(component);
        }
        return component;
    }

    function getComponent(id) {
        var component = objects[id];
        if (!component) {
            component = models[id];
        }
        return component;
    }

    function flattenTransform(object) {
        object.transform = new xeogl.Scale(object, {
            parent: new xeogl.Quaternion(object, {
                parent: new xeogl.Translate(object, {
                    parent: object.transform
                })
            })
        });
        flattened[object.id] = true;
    }

    function error(msg) {
        console.log(msg);
    }

    if (cfg) {
        this.bookmark(cfg);
    }
}