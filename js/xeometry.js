/**
 * A convenient API for visualizing glTF models on WebGL using xeogl.
 *
 * Find usage instructions at http://xeolabs.com-xeometry
 *
 * @param {Object} cfg
 * @param {Function(src, ok, error)} cfg.load
 */
var xeometry = {};

xeometry.Viewer = function (cfg) {

    var self = this;

    cfg = cfg || {};

    var load = cfg.load; // Optional callback to load models

    var scene = new xeogl.Scene({
        canvas: cfg.canvas
        //,
        //transparent: true
    });

    var math = xeogl.math;
    var camera = scene.camera;
    var view = camera.view;

    var types = {}; // List of objects for each type
    var models = {}; // Models mapped to their IDs
    var objects = {}; // Objects mapped to their IDs
    var annotations = {}; // Annotations mapped to their IDs
    var objectAnnotations = {}; // Annotations for each object
    //var typeAnnotations = {}; // Annotations for each type
    var eulerAngles = {}; // Euler rotation angles for each model and object
    var rotations = {}; // xeogl.Rotate for each model and object
    var translations = {}; // xeogl.Translate for each model and object
    var scales = {}; // xeogl.Scale for each model and object
    var objectModels = {}; // Model of each object
    var transformable = {}; // True for each model and object that has transforms
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
        duration: 0.1
    });

    //var cameraControl = new xeogl.CameraControl(scene);

    //----------------------------------------------------------------------------------------------------
    // Models
    //----------------------------------------------------------------------------------------------------

    /**
     * Gets the WebGL canvas.
     *
     * @returns {HTMLCanvasElement}
     */
    this.getCanvas = function () {
        return scene.canvas.canvas;
    };

    /**
     * Returns the viewer's HTML overlay element, which overlays the canvas.
     *
     * This element exists to catch input events over the canvas, while allowing
     * the HTML elements for annotations (etc) to avoid getting those events.
     *
     * @returns {HTMLDivElement}
     */
    this.getOverlay = function () {
        return scene.canvas.overlay;
    };

    /**
     * Loads a model into the viewer.
     *
     * Also assigns the model an ID, which gets prefixed to the IDs of the model's objects.
     *
     * @param {String} id ID to assign to the model.
     * @param {String|Object} src If the viewer was configured with a load callback, then this should be
     * ID with which to get an embedded glTF JSON file through the loader, otherwise it should be a path a glTF file.
     * @param {Function} [ok] Callback fired when model loaded.
     */
    this.loadModel = function (id, src, ok) {
        var isFilePath = xeogl._isString(src);
        var model = models[id];
        if (model) {
            if (isFilePath && src === model.src) {
                if (ok) {
                    ok(model.id);
                }
                return;
            }
            this.unloadModel(id);
        }
        if (scene.components[id]) {
            error("Component with this ID already exists: " + id);
            if (ok) {
                ok(id);
            }
            return;
        }
        model = new xeogl.GLTFModel(scene, {
            id: id,
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
                    // Register for type
                    meta = object.meta;
                    var type = meta && meta.type ? meta.type : "DEFAULT";
                    var objectsOfType = (types[type] || (types[type] = {}));
                    objectsOfType[id] = object;
                }
            }
            if (ok) {
                ok(model.id);
            }
        });
        if (load) {
            load(src, function (gltf) {
                    var basePath = null;
                    xeogl.GLTFModel.parse(model, gltf, basePath); // Synchronous
                },
                function (errMsg) {
                    error("Error loading model: " + errMsg);
                    if (ok) {
                        ok();
                    }
                })
        } else {
            model.src = src;
        }
    };

    /**
     * Gets the IDs of the models in the viewer.
     *
     * @return {String[]} IDs of the models.
     */
    this.getModels = function () {
        return Object.keys(models);
    };

    /**
     * Gets the ID of an object's model
     *
     * @param {String} id ID of an object.
     * @return {String} ID of the object's model.
     */
    this.getModel = function (id) {
        var object = objects[id];
        if (!object) {
            error("Object not found: " + id);
            return;
        }
        return objectModels[id];
    };

    /**
     * Gets the IDs of the objects within a model or a type.
     *
     * Returns the IDs of all objects in the viewer when no arguments are given.
     *
     * @param {String|String[]} id ID of a model or a type.
     * @return {String[]} IDs of the objects.
     */
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

    /**
     * Unloads a model.
     *
     * @param {String} id ID of the model.
     */
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
                // Deregister for type
                meta = entity.meta;
                var type = meta && meta.type ? meta.type : "DEFAULT";
                var objectsOfType = types[type];
                if (objectsOfType) {
                    delete objectsOfType[entityId];
                }
                delete objects[entityId];
                delete objectModels[entityId];
                delete eulerAngles[entityId];
                delete transformable[entityId];
                delete translations[entityId];
                delete rotations[entityId];
                delete scales[entityId];
            }
        }
        model.destroy();
        delete models[id];
        delete eulerAngles[id];
    };

    /**
     * Unloads all models, objects, annotations and clipping planes.
     */
    this.clear = function () {
        for (var id in models) {
            if (models.hasOwnProperty(id)) {
                this.unloadModel(id);
            }
        }
        this.clearAnnotations();
    };

    /**
     * Assigns a type to the given object(s).
     *
     * @param {String} id ID of an object or model. When a model ID is given, the type will be assigned to all the model's objects.
     * @param {String} type The type.
     */
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

    /**
     * Gets the type of an object.
     *
     * @param {String} id ID of the object.
     * @returns {String} The type of the object.
     */
    this.getType = function (id) {
        var object = objects[id];
        if (object) {
            var meta = object.meta;
            return meta && meta.type ? meta.type : "DEFAULT";
        }
        error("Object not found: " + id);
    };

    /**
     * Gets all types currently in the viewer.
     *
     * @returns {String} The types in the viewer.
     */
    this.getTypes = function () {
        return Object.keys(types);
    };

    //----------------------------------------------------------------------------------------------------
    // Transformation
    //----------------------------------------------------------------------------------------------------

    /**
     * Sets the scale of a model or object.
     *
     * An object's scale is applied relative to its model's scale.
     *
     * @param {String} id ID of a model or object.
     * @param {[Number, Number, Number]} xyz Scale factors for the X, Y and Z axis.
     */
    this.setScale = function (id, xyz) {
        var scale = scales[id];
        if (!scale) {
            var component = getTransformableComponent(id);
            if (!component) {
                error("Model or object not found: " + id);
                return;
            }
            scale = scales[id];
        }
        scale.xyz = xyz;
    };

    /**
     * Gets the scale of a model or object.
     *
     * An object's scale is applied relative to its model's scale.
     *
     * @param {String} id ID of a model or object.
     * @return {[Number, Number, Number]} scale Scale factors for the X, Y and Z axis.
     */
    this.getScale = function (id) {
        var scale = scales[id];
        if (!scale) {
            var component = getTransformableComponent(id);
            if (!component) {
                error("Model or object not found: " + id);
                return;
            }
            scale = scales[id];
        }
        return scale.xyz.slice();
    };

    /**
     * Sets the rotation of a model or object.
     *
     * An object's rotation is applied relative to its model's scale.
     *
     * @param {String} id ID of a model or object.
     * @param {[Number, Number, Number]} xyz Rotation angles for the X, Y and Z axis.
     */
    this.setRotate = (function () {
        var quat = math.vec4();
        return function (id, xyz) {
            var rotation = rotations[id];
            if (!rotation) {
                var component = getTransformableComponent(id);
                if (!component) {
                    error("Model or object not found: " + id);
                    return;
                }
                rotation = rotations[id];
            }
            math.eulerToQuaternion(xyz, "XYZ", quat); // Tait-Bryan Euler angles
            rotation.xyzw = quat;
            var saveAngles = eulerAngles[id] || (eulerAngles[id] = math.vec3());
            saveAngles.set(xyz);
        };
    })();

    /**
     * Gets the rotation of a model or object.
     *
     * An object's rotation is applied relative to its model's scale.
     *
     * @param {String} id ID of a model or object.
     * @return {[Number, Number, Number]} Rotation angles for the X, Y and Z axis.
     */
    this.getRotate = function (id) {
        var component = getTransformableComponent(id);
        if (!component) {
            error("Model or object not found: " + id);
            return;
        }
        var angles = eulerAngles[id];
        return angles ? angles.slice() : math.vec3([0, 0, 0]);
    };

    /**
     * Sets the translation of a model or object.
     *
     * An object's translation is applied relative to its model's scale.
     *
     * @param {String} id ID of a model or object.
     * @param {[Number, Number, Number]} xyz World-space translation vector.
     */
    this.setTranslate = function (id, xyz) {
        var translation = translations[id];
        if (!translation) {
            var component = getTransformableComponent(id);
            if (!component) {
                error("Model or object not found: " + id);
                return;
            }
            translation = translations[id];
        }
        translation.xyz = xyz;
    };

    /**
     * Increments the translation of a model or object.
     *
     * An object's translation is applied relative to its model's translation.
     *
     * @param {String} id ID of a model or object.
     * @param {[Number, Number, Number]} xyz World-space translation vector.
     */
    this.addTranslate = function (id, xyz) {
        var translation = translations[id];
        if (!translation) {
            var component = getTransformableComponent(id);
            if (!component) {
                error("Model or object not found: " + id);
                return;
            }
            translation = translations[id];
        }
        var xyzOld = translation.xyz;
        translation.xyz = [xyzOld[0] + xyz[0], xyzOld[1] + xyz[1], xyzOld[2] + xyz[2]]
    };

    /**
     * Gets the translation of a model or object.
     *
     * An object's translation is applied relative to its model's translation.
     *
     * @param {String} id ID of a model or object.
     * @return {[Number, Number, Number]} World-space translation vector.
     */
    this.getTranslate = function (id) {
        var translation = translations[id];
        if (!translation) {
            var component = getTransformableComponent(id);
            if (!component) {
                error("Model or object not found: " + id);
                return;
            }
            translation = translations[id];
        }
        return translation.xyz.slice();
    };

    function getTransformableComponent(id) {
        var component = getComponent(id);
        if (!component) {
            return;
        }
        if (transformable[id]) {
            return component;
        }
        if (models[id]) {
            buildModelTransform(component);
        } else {
            buildObjectTransform(component);
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

    var buildModelTransform = (function () {
        var offset = new Float32Array(3);
        var negOffset = new Float32Array(3);
        return function (model) {
            var modelCenter = model.worldBoundary.center;
            var sceneCenter = scene.worldBoundary.center;
            math.subVec3(modelCenter, sceneCenter, offset);
            math.mulVec3Scalar(offset, -1, negOffset);
            var id = model.id;
            model.transform = new xeogl.Translate(model, {
                xyz: negOffset,
                parent: scales[id] = new xeogl.Scale(model, {
                    parent: rotations[id] = new xeogl.Quaternion(model, {
                        parent: translations[id] = new xeogl.Translate(model, {
                            parent: new xeogl.Translate(model, {
                                xyz: offset
                            })
                        })
                    })
                })
            });
            transformable[model.id] = true;
        };
    })();

    var buildObjectTransform = (function () {
        var matrix = new Float32Array(16);
        var offset = new Float32Array(3);
        var negOffset = new Float32Array(3);
        return function (object) {
            var objectId = object.id;
            var model = objectModels[objectId];
            var objectCenter = object.worldBoundary.center;
            var sceneCenter = scene.worldBoundary.center;
            math.subVec3(objectCenter, sceneCenter, offset);
            math.mulVec3Scalar(offset, -1, negOffset);
            var modelTransform = model.transform;
            math.identityMat4(matrix);
            for (var transform = object.transform; transform.id !== modelTransform.id; transform = transform.parent) {
                math.mulMat4(matrix, transform.matrix, matrix);
            }
            object.transform = new xeogl.Transform(object, {
                matrix: matrix,
                parent: new xeogl.Translate(object, {
                    xyz: negOffset,
                    parent: scales[objectId] = new xeogl.Scale(object, {
                        parent: rotations[objectId] = new xeogl.Quaternion(object, {
                            parent: translations[objectId] = new xeogl.Translate(object, {
                                parent: new xeogl.Translate(object, {
                                    xyz: offset,
                                    parent: model.transform
                                })
                            })
                        })
                    })
                })
            });
            transformable[object.id] = true;
        };
    })();

    //----------------------------------------------------------------------------------------------------
    // Visibility
    //----------------------------------------------------------------------------------------------------

    /**
     * Shows model(s) and/or object(s).
     *
     * Shows all objects in the viewer when no arguments are given.
     *
     * @param {String|String[]} ids IDs of model(s) and/or object(s). Shows all objects by default.
     */
    this.show = function (ids) {
        setVisible(ids, true);
    };

    /**
     * Hides model(s) and/or object(s).
     *
     * Hides all objects in the viewer when no arguments are given.
     *
     * @param {String|String[]} ids IDs of model(s) and/or object(s).
     */
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

    //----------------------------------------------------------------------------------------------------
    // Opacity
    //----------------------------------------------------------------------------------------------------

    /**
     * Sets opacity of model(s), object(s) or type(s).
     *
     * @param {String|String[]} ids IDs of models, objects or types. Shows all objects by default.
     * @param {Number} opacity Degree of opacity in range [0..1].
     */
    this.setOpacity = function (ids, opacity) {
        if (opacity === null || opacity === undefined) {
            opacity = 1.0;
        }
        if (ids === undefined || ids === null) {
            self.setOpacity(self.getObjects(), opacity);
            return;
        }
        if (xeogl._isString(ids)) {
            var id = ids;
            var object = objects[id];
            if (object) {
                object.modes.transparent = (opacity < 1);
                object.material.opacity = opacity;
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
                    self.setOpacity(typeIds, opacity);
                    return
                }
                error("Model, object or type not found: " + id);
                return;
            }
            self.setOpacity(self.getObjects(id), opacity);
            return;
        }
        for (var i = 0, len = ids.length; i < len; i++) {
            self.setOpacity(ids[i], opacity);
        }
    };

    /**
     * Gets the opacity of an object.
     *
     * @param {String|String} id ID of an object.
     * @return {Number} Degree of opacity in range [0..1].
     */
    this.getOpacity = function (id) {
        var object = objects[id];
        if (!object) {
            error("Model, object or type not found: " + id);
            return 1.0;
        }
        return object.material.opacity;
    };

    //----------------------------------------------------------------------------------------------------
    // Color
    //----------------------------------------------------------------------------------------------------

    /**
     * Sets the color of model(s), object(s) or type(s).
     *
     * @param {String|String[]} ids IDs of models, objects or types. Applies to all objects by default.
     * @param {[Number, Number, Number]} color The RGB color, with each element in range [0..1].
     */
    this.setColor = function (ids, color) {
        if (color === null || color === undefined) {
            color = 1.0;
        }
        if (ids === undefined || ids === null) {
            self.setColor(self.getObjects(), color);
            return;
        }
        if (xeogl._isString(ids)) {
            var id = ids;
            var object = objects[id];
            if (object) {
                var material = object.material;
                if (material.diffuse) {
                    material.diffuse = color; // xeogl.SpecularMaterial or xeogl.Phongmaterial
                } else {
                    material.baseColor = color; // xeogl.MetallicMaterial
                }
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
                    self.setColor(typeIds, color);
                    return
                }
                error("Model, object or type not found: " + id);
                return;
            }
            self.setColor(self.getObjects(id), color);
            return;
        }
        for (var i = 0, len = ids.length; i < len; i++) {
            self.setColor(ids[i], color);
        }
    };

    /**
     * Gets the albedo color of an object.
     *
     * @param {String|String} id ID of an object.
     * @return {[Number, Number, Number]} color The RGB color of the object, with each element in range [0..1].
     */
    this.getColor = function (id) {
        var object = objects[id];
        if (!object) {
            error("Model, object or type not found: " + id);
            return 1.0;
        }
        var material = object.material;
        var color = material.diffuse || material.baseColor || [1, 1, 1]; // PhongMaterial || SpecularMaterial || MetallicMaterial
        return color.slice();
    };

    //----------------------------------------------------------------------------------------------------
    // Outlines
    //----------------------------------------------------------------------------------------------------

    /**
     * Sets the thickness of outlines around objects.
     * @param {Number} thickness Thickness in pixels.
     */
    this.setOutlineThickness = function (thickness) {
        scene.outline.thickness = thickness;
    };

    /**
     * Gets the thickness of outlines around objects.
     * @return {Number} Thickness in pixels.
     */
    this.getOutlineThickness = function () {
        return scene.outline.thickness;
    };

    /**
     * Sets the color of outlines around objects.
     * @param {[Number, Number, Number]} color RGB color as a value per channel, in range [0..1].
     */
    this.setOutlineColor = function (color) {
        scene.outline.color = color;
    };

    /**
     * Returns the color of outlines around objects.
     * @return {[Number, Number, Number]} RGB color as a value per channel, in range [0..1].
     */
    this.getOutlineColor = function () {
        return scene.outline.color;
    };

    /**
     * Shows outline around model(s) and/or object(s).
     *
     * Outlines all objects in the viewer when no arguments are given.
     *
     * @param {String|String[]} ids IDs of model(s) and/or object(s). Outlines all objects by default.
     */
    this.showOutline = function (ids) {
        setOutline(ids, true);
    };

    /**
     * Shows outline around model(s) and/or object(s).
     *
     * Hides all outlines in the viewer when no arguments are given.
     *
     * @param {String|String[]} ids IDs of model(s) and/or object(s).
     */
    this.hideOutline = function (ids) {
        setOutline(ids, false);
    };

    function setOutline(ids, outline) {
        if (ids === undefined || ids === null) {
            setOutline(self.getObjects(), outline);
            return;
        }
        if (xeogl._isString(ids)) {
            var id = ids;
            var object = objects[id];
            if (object) {
                object.modes.outline = outline;
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
                    setOutline(typeIds, outline);
                    return
                }
                error("Model, object or type not found: " + id);
                return;
            }
            setOutline(self.getObjects(id), outline);
            return;
        }
        for (var i = 0, len = ids.length; i < len; i++) {
            setOutline(ids[i], outline);
        }
    }

    //----------------------------------------------------------------------------------------------------
    // Boundaries
    //----------------------------------------------------------------------------------------------------

    /**
     * Gets the center point of the given models and/or objects.
     *
     * When no arguments are given, returns the collective center of all objects in the viewer.
     *
     * @param {String|String[]} target IDs of models and/or objects.
     * @returns {[Number, Number, Number]} The World-space center point.
     */
    this.getCenter = function (target) {
        var aabb = this.getAABB(target);
        return new Float32Array([
            (aabb[0] + aabb[3]) / 2,
            (aabb[1] + aabb[4]) / 2,
            (aabb[2] + aabb[5]) / 2
        ]);
    };

    /**
     * Gets the boundary of the given models and/or objects.
     *
     * When no arguments are given, returns the collective boundary of all objects in the viewer.
     *
     * When you specify IDs of annotations, then the boundaries of the annotations' objects are considered.
     *
     * @param {String|String[]} target IDs of models, objects and/or annotations
     * @returns {[Number, Number, Number, Number, Number, Number]} An axis-aligned World-space bounding box, given as elements ````[xmin, ymin, zmin, xmax, ymax, zmax]````.
     */
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

    //----------------------------------------------------------------------------------------------------
    // Camera
    //----------------------------------------------------------------------------------------------------

    /**
     * Sets the camera viewpoint.
     *
     * @param {[Number, Number, Number]} eye The new viewpoint.
     */
    this.setEye = function (eye) {
        view.eye = eye;
    };

    /**
     * Gets the camera viewpoint.
     *
     * @return {[Number, Number, Number]} The current viewpoint.
     */
    this.getEye = function () {
        return view.eye;
    };

    /**
     * Sets the camera's point-of-interest.
     *
     * @param {[Number, Number, Number]} look The new point-of-interest.
     */
    this.setLook = function (look) {
        view.look = look;
    };

    /**
     * Gets the camera's point-of-interest.
     *
     * @return {[Number, Number, Number]} The current point-of-interest.
     */
    this.getLook = function () {
        return view.look;
    };

    /**
     * Sets the camera's "up" direction.
     *
     * @param {[Number, Number, Number]} up The new up direction.
     */
    this.setUp = function (up) {
        view.up = up;
    };

    /**
     * Gets the camera's "up" direction.
     *
     * @return {[Number, Number, Number]} The current "up" direction.
     */
    this.getUp = function () {
        return view.up;
    };

    /**
     * Sets the camera's pose, consisting of position, target and "up" vector.
     *
     * @param {[Number, Number, Number]} eye Camera's new viewpoint.
     * @param {[Number, Number, Number]} look Camera's new point-of-interest.
     * @param {[Number, Number, Number]} up Camera's new up direction.
     */
    this.setEyeLookUp = function (eye, look, up) {
        view.eye = eye;
        view.look = look;
        view.up = up || [0, 1, 0];
    };

    /**
     * Rotates the camera's 'eye' position about its 'look' position, around the 'up' vector.
     *
     * @param {Number} angle Angle of rotation in degrees
     */
    this.rotateEyeY = function (angle) {
        view.rotateEyeY(angle);
    };

    /**
     * Rotates the camera's 'eye' position about its 'look' position, pivoting around the X-axis.
     *
     * @param {Number} angle Angle of rotation in degrees
     */
    this.rotateEyeX = function (angle) {
        view.rotateEyeX(angle);
    };

    /**
     * Rotates the camera's 'look' position about its 'eye' position, pivoting around the 'up' vector.
     *
     * <p>Applies constraints added with {@link #addConstraint}.</p>
     *
     * @param {Number} angle Angle of rotation in degrees
     */
    this.rotateLookY = function (angle) {
        view.rotateLookY(angle);
    };

    /**
     * Rotates the camera's 'eye' position about its 'look' position, pivoting around the X-axis.
     *
     * @param {Number} angle Angle of rotation in degrees
     */
    this.rotateLookX = function (angle) {
        view.rotateLookX(angle);
    };

    /**
     * Pans the camera along its local X, Y or Z axis.
     * @param pan The pan vector
     */
    this.pan = function (pan) {
        view.pan(pan);
    };

    /**
     * Increments/decrements the camera's zoom distance, ie. distance between eye and look.
     * @param delta
     */
    this.zoom = function (delta) {
        view.zoom(delta);
    };

    /**
     * Sets the camera's flight duration when fitting elements to view.
     *
     * A value of zero (default) will cause the camera to instantly jump to each new target .
     *
     * @param {Number} value The new flight duration, in seconds.
     */
    this.setViewFitDuration = function (value) {
        cameraFlight.duration = value;
    };

    /**
     * Gets the camera's flight duration when fitting elements to view.
     *
     * @returns {Number} The current flight duration, in seconds.
     */
    this.getViewFitDuration = function () {
        return cameraFlight.duration;
    };

    /**
     * Sets the target field-of-view (FOV) angle when fitting elements to view.
     *
     * This is the portion of the total frustum FOV that the elements' boundary
     * will occupy when fitted to view.
     *
     * Default value is 45.
     *
     * @param {Number} value The new view-fit FOV angle, in degrees.
     */
    this.setViewFitFOV = function (value) {
        cameraFlight.fitFOV = value;
    };

    /**
     * Gets the target field-of-view angle when fitting elements to view.
     *
     * @returns {Number} The current view-fit FOV angle, in degrees.
     */
    this.getViewFitFOV = function () {
        return cameraFlight.fitFOV;
    };

    /**
     * Moves the camera to fit the given model(s), object(s) or boundary(s) in view.
     *
     * Preserves the direction that the camera is currently pointing in.
     *
     * A boundary is an axis-aligned World-space bounding box, given as elements ````[xmin, ymin, zmin, xmax, ymax, zmax]````.
     *
     * @param {String|[]} target The elements to fit in view, given as either the ID of model, ID of object, a boundary, or an array containing mixture of IDs and boundaries.
     * @param {Function()} [ok] Callback fired when camera has arrived at its target position.
     */
    this.viewFit = function (target, ok) {
        (ok || cameraFlight.duration > 0.1) ? cameraFlight.flyTo({aabb: this.getAABB(target)}, ok) : cameraFlight.jumpTo({aabb: this.getAABB(target)});
    };

    /**
     * Moves the camera to fit the given model(s), object(s) or boundary(s) in view, while looking dalong the +X axis.
     *
     * @param {String|[]} target The element(s) to fit in view, given as either the ID of model, ID of object, a boundary, or an array containing mixture of IDs and boundaries.
     * @param {Function()} [ok] Callback fired when camera has arrived at its target position.
     */
    this.viewFitRight = function (target, ok) {
        viewFitAxis(target, 0, ok);
    };

    /**
     * Moves the camera to fit the given model(s), object(s) or boundary(s) in view, while looking along the +Z axis.
     *
     * @param {String|[]} target The element(s) to fit in view, given as either the ID of model, ID of object, a boundary, or an array containing mixture of IDs and boundaries.
     * @param {Function()} [ok] Callback fired when camera has arrived at its target position.
     */
    this.viewFitBack = function (target, ok) {
        viewFitAxis(target, 1, ok);
    };

    /**
     * Moves the camera to fit the given model(s), object(s) or boundary(s) in view, while looking along the -X axis.
     *
     * @param {String|[]} target The element(s) to fit in view, given as either the ID of model, ID of object, a boundary, or an array containing mixture of IDs and boundaries.
     * @param {Function()} [ok] Callback fired when camera has arrived at its target position.
     */
    this.viewFitLeft = function (target, ok) {
        viewFitAxis(target, 2, ok);
    };

    /**
     * Moves the camera to fit the given model(s), object(s) or boundary(s) in view, while looking along the +X axis.
     *
     * @param {String|[]} target The element(s) to fit in view, given as either the ID of model, ID of object, a boundary, or an array containing mixture of IDs and boundaries.
     * @param {Function()} [ok] Callback fired when camera has arrived at its target position.
     */
    this.viewFitFront = function (target, ok) {
        viewFitAxis(target, 3, ok);
    };

    /**
     * Moves the camera to fit the given model(s), object(s) or boundary(s) in view, while looking along the -Y axis.
     *
     * @param {String|[]} target The element(s) to fit in view, given as either the ID of model, ID of object, a boundary, or an array containing mixture of IDs and boundaries.
     * @param {Function()} [ok] Callback fired when camera has arrived at its target position.
     */
    this.viewFitTop = function (target, ok) {
        viewFitAxis(target, 4, ok);
    };

    /**
     * Moves the camera to fit the given model(s), object(s) or boundary(s) in view, while looking along the +X axis.
     *
     * @param {String|[]} target The element(s) to fit in view, given as either the ID of model, ID of object, a boundary, or an array containing mixture of IDs and boundaries.
     * @param {Function()} [ok] Callback fired when camera has arrived at its target position.
     */
    this.viewFitBottom = function (target, ok) {
        viewFitAxis(target, 5, ok);
    };

    var viewFitAxis = (function () {
        var center = new math.vec3();
        return function (target, axis, ok) {
            var aabb = self.getAABB(target);
            var diag = math.getAABB3Diag(aabb);
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
            if (ok || cameraFlight.duration > 0) {
                cameraFlight.flyTo(cameraTarget, ok);
            } else {
                cameraFlight.jumpTo(cameraTarget);
            }
        };
    })();

    this.zoom = function (zoom) {
        view.zoom(zoom);
    };

    /**
     * Rotates the camera's 'eye' position about its 'look' position, pivoting
     * about the camera's local horizontal axis, by the given increment on each frame.
     *
     * Call with a zero value to stop spinning about this axis.
     *
     * @param {Number} value The increment angle, in degrees.
     */
    this.yspin = function (value) {
        return (arguments.length === 0) ? yspin : yspin = value;
    };

    /**
     * Rotates the camera's 'eye' position about its 'look' position, pivoting
     * about the camera's horizontal axis, by the given  increment on each frame.
     *
     * Call again with a zero value to stop spinning about this axis.
     *
     * @param {Number} value The increment angle, in degrees.
     */
    this.xspin = function (value) {
        return (arguments.length === 0) ? xspin : xspin = value;
    };

    //----------------------------------------------------------------------------------------------------
    // Ray casting
    //----------------------------------------------------------------------------------------------------

    /**
     * Gets the first object that intersects the given ray.
     *
     * @param {[Number, Number, Number]} origin World-space ray origin.
     * @param {[Number, Number, Number]} dir World-space ray direction vector.
     * @returns {{id: *}} If object found, the ID of the object.
     */
    this.rayCastObject = function (origin, dir) {
        var hit = scene.pick({origin: origin, direction: dir, pickSurface: false});
        if (hit) {
            return {id: hit.entity.id};
        }
    };

    /**
     * Gets the first object that intersects the given ray, along with the
     * coordinates of the ray-surface intersection.
     *
     * @param {[Number, Number, Number]} origin World-space ray origin.
     * @param {[Number, Number, Number]} dir World-space ray direction vector.
     * @returns {{id: *, worldPos: *, primIndex: (*|number), bary: *}} If object found, the ID of object, World-space
     * surface intersection, primitive index and barycentric coordinates.
     */
    this.rayCastSurface = function (origin, dir) {
        var hit = scene.pick({origin: origin, direction: dir, pickSurface: true});
        if (hit) {
            return {
                id: hit.entity.id,
                worldPos: hit.worldPos,
                primIndex: hit.primIndex,
                bary: hit.bary
            };
        }
    };

    /**
     * Finds the closest object at the given canvas position.
     *
     * @param {[Number, Number]} canvasPos Canvas position.
     * @returns {{id: *}}
     */
    this.pickObject = function (canvasPos) {
        var hit = scene.pick({canvasPos: canvasPos, pickSurface: false});
        if (hit) {
            return {id: hit.entity.id};
        }
    };

    /**
     * Finds the closest object at the given canvas position, plus the
     * object's surface coordinates at that position.
     *
     * @param {[Number, Number]} canvasPos Canvas position.
     * @returns {{id: *, worldPos: *, primIndex: (*|number), bary: *}} If object found, the ID of object, World-space surface intersection, primitive index and barycentric coordinates.
     */
    this.pickSurface = function (canvasPos) {
        var hit = scene.pick({canvasPos: canvasPos, pickSurface: true});
        if (hit) {
            return {
                id: hit.entity.id,
                worldPos: hit.worldPos,
                primIndex: hit.primIndex,
                bary: hit.bary
            };
        }
    };

    //----------------------------------------------------------------------------------------------------
    // Annotations
    //----------------------------------------------------------------------------------------------------

    this.createAnnotation = function (id, cfg) {
        if (scene.components[id]) {
            error("Component with this ID already exists: " + id);
            return;
        }
        if (cfg === undefined) {
            error("Annotation configuration expected");
            return;
        }
        var objectId = cfg.object;
        if (objectId === undefined) {
            error("Annotation property expected: objectId");
            return;
        }
        var object = objects[objectId];
        if (!object) {
            error("Object not found: " + objectId);
            return;
        }
        var primIndex = cfg.primIndex;
        if (primIndex === undefined) {
            error("Annotation property expected: primIndex");
            return;
        }
        var annotation = new xeogl.Annotation(scene, {
            id: id,
            entity: object,
            primIndex: primIndex,
            bary: cfg.bary,
            eye: cfg.eye,
            look: cfg.look,
            up: cfg.up,
            occludable: cfg.occludable,
            glyph: cfg.glyph,
            title: cfg.title,
            desc: cfg.desc,
            pinShown: cfg.pinShown,
            labelShown: cfg.labelShown
        });
        annotations[annotation.id] = annotation;
        var oa = objectAnnotations[objectId] || (objectAnnotations[objectId] = {});
        oa[annotation.id] = annotation;
    };

    this.getAnnotations = function (id) {
        //if (id !== undefined || id === null) {
        //    var objectsOfType = types[id];
        //    if (objectsOfType) {
        //    //    return Object.keys(objectsOfType);
        //    }
        //    var model = models[id];
        //    if (!model) {
        //        error("Model not found: " + id);
        //        return [];
        //    }
        //    var entities = model.types["xeogl.Entity"];
        //    if (!entities) {
        //        return [];
        //    }
        //    return Object.keys(entities);
        //}
        return Object.keys(annotations);
    };

    this.destroyAnnotation = function (id) {
        var annotation = annotations[id];
        if (!annotation) {
            return;
        }
        if (annotation.entity) {
            delete objectAnnotations[annotation.entity.id][annotation.id];
        }
        annotation.destroy();
        delete annotations[id];
    };

    this.clearAnnotations = function () {
        for (var ids = Object.keys(annotations), i = 0; i < ids.length; i++) {
            this.destroyAnnotation(ids[i]);
        }
    };

    this.setAnnotationPrimIndex = function (id, primIndex) {
        var annotation = annotations[id];
        if (!annotation) {
            this.error("Annotation not found: \"" + id + "\"");
            return;
        }
        annotation.primIndex = primIndex;
    };

    this.getAnnotationPrimIndex = function (id) {
        var annotation = getAnnotation(id);
        if (!annotation) {
            this.error("Annotation not found: \"" + id + "\"");
            return;
        }
        return annotation.primIndex;
    };

    this.setAnnotationTitle = function (id, title) {
        var annotation = annotations[id];
        if (!annotation) {
            this.error("Annotation not found: \"" + id + "\"");
            return;
        }
        annotation.title = title;
    };

    this.getAnnotationTitle = function (id) {
        var annotation = annotations[id];
        if (!annotation) {
            this.error("Annotation not found: \"" + id + "\"");
            return;
        }
        return annotation.title;
    };

    this.setAnnotationDesc = function (id, desc) {
        var annotation = annotations[id];
        if (!annotation) {
            this.error("Annotation not found: \"" + id + "\"");
            return;
        }
        annotation.desc = desc;
    };

    this.getAnnotationDesc = function (id) {
        var annotation = annotations[id];
        if (!annotation) {
            this.error("Annotation not found: \"" + id + "\"");
            return;
        }
        return annotation.desc;
    };

    this.setAnnotationBary = function (id, bary) {
        var annotation = annotations[id];
        if (!annotation) {
            this.error("Annotation not found: \"" + id + "\"");
            return;
        }
        annotation.bary = bary;
    };

    this.getAnnotationBary = function (id) {
        var annotation = annotations[id];
        if (!annotation) {
            this.error("Annotation not found: \"" + id + "\"");
            return;
        }
        return annotation.bary;
    };

    this.setAnnotationObject = function (id, objectId) {
        var annotation = annotations[id];
        if (!annotation) {
            this.error("Annotation not found: \"" + id + "\"");
            return;
        }
        var object = objects[objectId];
        if (!object) {
            this.error("Object not found: \"" + objectId + "\"");
            return;
        }
        annotation.entity = object;
    };

    this.getAnnotationObject = function (id) {
        var annotation = annotations[id];
        if (!annotation) {
            this.error("Annotation not found: \"" + id + "\"");
            return;
        }
        var entity = annotation.entity;
        return entity ? entity.id : null;
    };

    this.setAnnotationEye = function (id, eye) {
        var annotation = annotations[id];
        if (!annotation) {
            this.error("Annotation not found: \"" + id + "\"");
            return;
        }
        annotation.eye = eye;
    };

    this.getAnnotationEye = function (id) {
        var annotation = annotations[id];
        if (!annotation) {
            this.error("Annotation not found: \"" + id + "\"");
            return;
        }
        return annotation.eye;
    };

    this.setAnnotationLook = function (id, look) {
        var annotation = annotations[id];
        if (!annotation) {
            this.error("Annotation not found: \"" + id + "\"");
            return;
        }
        annotation.look = look;
    };

    this.getAnnotationLook = function (id) {
        var annotation = annotations[id];
        if (!annotation) {
            this.error("Annotation not found: \"" + id + "\"");
            return;
        }
        return annotation.look;
    };

    this.setAnnotationUp = function (id, up) {
        var annotation = annotations[id];
        if (!annotation) {
            this.error("Annotation not found: \"" + id + "\"");
            return;
        }
        annotation.up = up;
    };

    this.getAnnotationUp = function (id) {
        var annotation = annotations[id];
        if (!annotation) {
            this.error("Annotation not found: \"" + id + "\"");
            return;
        }
        return annotation.up;
    };

    this.setAnnotationOccludable = function (id, occludable) {
        var annotation = annotations[id];
        if (!annotation) {
            this.error("Annotation not found: \"" + id + "\"");
            return;
        }
        annotation.occludable = occludable;
    };

    this.getAnnotationOccludable = function (id) {
        var annotation = annotations[id];
        if (!annotation) {
            this.error("Annotation not found: \"" + id + "\"");
            return;
        }
        return annotation.occludable;
    };

    this.setPinShown = function (id, pinShown) {
        var annotation = annotations[id];
        if (!annotation) {
            this.error("Annotation not found: \"" + id + "\"");
            return;
        }
        annotation.pinShown = pinShown;
    };

    this.getAnnotationPinShown = function (id) {
        var annotation = annotations[id];
        if (!annotation) {
            this.error("Annotation not found: \"" + id + "\"");
            return;
        }
        return annotation.pinShown;
    };

    this.setAnnotationLabelShown = function (id, labelShown) {
        var annotation = annotations[id];
        if (!annotation) {
            this.error("Annotation not found: \"" + id + "\"");
            return;
        }
        annotation.labelShown = labelShown;
    };

    this.getAnnotationLabelShown = function (id) {
        var annotation = annotations[id];
        if (!annotation) {
            this.error("Annotation not found: \"" + id + "\"");
            return;
        }
        return annotation.labelShown;
    };

    this.setAnnotationGlyph = function (id, glyph) {
        var annotation = annotations[id];
        if (!annotation) {
            this.error("Annotation not found: \"" + id + "\"");
            return;
        }
        annotation.glyph = glyph;
    };

    this.getAnnotationGlyph = function (id) {
        var annotation = annotations[id];
        if (!annotation) {
            this.error("Annotation not found: \"" + id + "\"");
            return;
        }
        return annotation.glyph;
    };

    //----------------------------------------------------------------------------------------------------
    // Arbitrary clipping planes
    //----------------------------------------------------------------------------------------------------

    this.createclip = function (id, cfg) {
        if (scene.components[id]) {
            error("Component with this ID already exists: " + id);
            return;
        }
        if (cfg === undefined) {
            error("Clip configuration expected");
            return;
        }
        var clip = new xeogl.Clip(scene, {
            id: id,
            entity: object,
            primIndex: primIndex,
            bary: cfg.bary,
            eye: cfg.eye,
            look: cfg.look,
            up: cfg.up,
            occludable: cfg.occludable,
            glyph: cfg.glyph,
            title: cfg.title,
            desc: cfg.desc,
            pinShown: cfg.pinShown,
            labelShown: cfg.labelShown
        });
        clips[clip.id] = clip;
        //scene.clips.clips = scene.clips.clips.push

    };

    this.getclips = function () {
        //if (id !== undefined || id === null) {
        //    var objectsOfType = types[id];
        //    if (objectsOfType) {
        //    //    return Object.keys(objectsOfType);
        //    }
        //    var model = models[id];
        //    if (!model) {
        //        error("Model not found: " + id);
        //        return [];
        //    }
        //    var entities = model.types["xeogl.Entity"];
        //    if (!entities) {
        //        return [];
        //    }
        //    return Object.keys(entities);
        //}
        return Object.keys(clips);
    };

    this.destroyClip = function (id) {
        var clip = clips[id];
        if (!clip) {
            return;
        }
        clip.destroy();
        delete clips[id];
    };

    this.clearClips = function () {
        for (var ids = Object.keys(clips), i = 0; i < ids.length; i++) {
            this.destroyClip(ids[i]);
        }
    };

    this.setClipPos = function (id, pos) {
        var clip = clips[id];
        if (!clip) {
            this.error("Clip not found: \"" + id + "\"");
            return;
        }
        clip.pos = pos;
    };

    this.getClipPos = function (id) {
        var clip = getclip(id);
        if (!clip) {
            this.error("Clip not found: \"" + id + "\"");
            return;
        }
        return clip.pos;
    };

    this.setClipDir = function (id, dir) {
        var clip = clips[id];
        if (!clip) {
            this.error("Clip not found: \"" + id + "\"");
            return;
        }
        clip.dir = dir;
    };

    this.getClipDir = function (id) {
        var clip = clips(id);
        if (!clip) {
            this.error("Clip not found: \"" + id + "\"");
            return;
        }
        return clip.dir;
    };

    //----------------------------------------------------------------------------------------------------
    // Bookmarking
    //----------------------------------------------------------------------------------------------------

    /**
     * Gets a JSON bookmark of the viewer's current state.
     *
     * The bookmark will be a complete snapshot of the viewer's state, including:
     *
     * <ul>
     * <li>which models are currently loaded,</li>
     * <li>transformations of the models,</li>
     * <li>transformations and visibilities of their objects, and</li>
     * <li>the current camera position.</li>
     * <ul>
     *
     * The viewer can then be restored to the bookmark at any time using #setBookmark().
     *
     * @return {Object} A JSON bookmark.
     */
    this.getBookmark = (function () {

        var vecToArray = math.vecToArray;

        function getTranslate(id) {
            var translation = translations[id];
            if (!translation) {
                return;
            }
            var xyz = translation.xyz;
            if (xyz[0] !== 0 || xyz[1] !== 0 || xyz[1] !== 0) {
                return vecToArray(xyz);
            }
        }

        function getScale(id) {
            var scale = scales[id];
            if (!scale) {
                return;
            }
            var xyz = scale.xyz;
            if (xyz && (xyz[0] !== 1 || xyz[1] !== 1 || xyz[1] !== 1)) {
                return vecToArray(xyz);
            }
        }

        function getRotate(id) {
            var xyz = eulerAngles[id];
            if (xyz && (xyz[0] !== 0 || xyz[1] !== 0 || xyz[2] !== 0)) {
                return vecToArray(xyz);
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
            for (id in models) {
                if (models.hasOwnProperty(id)) {
                    model = models[id];
                    modelData = {
                        id: id,
                        src: model.src
                    };
                    translate = getTranslate(id);
                    if (translate) {
                        modelData.translate = translate;
                    }
                    scale = getScale(id);
                    if (scale) {
                        modelData.scale = scale;
                    }
                    rotate = getRotate(id);
                    if (rotate) {
                        modelData.rotate = rotate;
                    }
                    bookmark.models.push(modelData);
                }
            }
            bookmark.objects = {};
            for (id in objects) {
                var object;
                var objectState;
                if (objects.hasOwnProperty(id)) {
                    object = objects[id];
                    objectState = null;
                    translate = getTranslate(id);
                    if (translate) {
                        objectState = objectState || (bookmark.objects[id] = {});
                        objectState.translate = translate;
                    }
                    scale = getScale(id);
                    if (scale) {
                        objectState = objectState || (bookmark.objects[id] = {});
                        objectState.scale = scale;
                    }
                    rotate = getRotate(id);
                    if (rotate) {
                        objectState = objectState || (bookmark.objects[id] = {});
                        objectState.rotate = rotate;
                    }
                    if (object.visibility.visible) {
                        objectState = objectState || (bookmark.objects[id] = {});
                        objectState.visible = true;
                    } else if (objectState) {
                        objectState.visible = false;
                    }
                    if (object.modes.transparent) {
                        objectState = objectState || (bookmark.objects[id] = {});
                        objectState.opacity = object.material.opacity;
                    }
                }
            }
            for (id in annotations) {
                var annotation;
                var annotationState;
                if (annotations.hasOwnProperty(id)) {
                    annotation = annotations[id];
                    annotationState = {
                        primIndex: annotation.primIndex,
                        bary: vecToArray(annotation.bary),
                        glyph: annotation.glyph,
                        title: annotation.title,
                        desc: annotation.desc,
                        pinShown: annotation.pinShown,
                        labelShown: annotation.labelShown,
                        occludable: annotation.occludable
                    };
                    if (annotation.entity) {
                        annotationState.object = annotation.entity.id;
                    }
                    if (annotation.eye) {
                        annotationState.eye = vecToArray(annotation.eye);
                    }
                    if (annotation.look) {
                        annotationState.look = vecToArray(annotation.look);
                    }
                    if (annotation.up) {
                        annotationState.up = vecToArray(annotation.up);
                    }
                    if (!bookmark.annotations) {
                        bookmark.annotations = {};
                    }
                    bookmark.annotations[id] = annotationState;
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

    /**
     * Sets viewer state to the snapshot contained in given JSON bookmark.
     *
     * A bookmark is a complete snapshot of the viewer's state, which was
     * captured earlier with #getBookmark().
     *
     * @param {Object} bookmark JSON bookmark.
     */
    this.setBookmark = (function () {

        function loadModels(_modelsData, i, ok) {
            if (i >= _modelsData.length) {
                ok();
                return;
            }
            var modelData = _modelsData[i];
            var id = modelData.id;
            self.loadModel(id, modelData.src, function () {
                if (modelData.translate) {
                    self.setTranslate(id, modelData.translate);
                }
                if (modelData.scale) {
                    self.setScale(id, modelData.scale);
                }
                if (modelData.rotate) {
                    self.setRotate(id, modelData.rotate);
                }
                loadModels(_modelsData, i + 1, ok);
            });
        }

        return function (bookmark) {
            if (!bookmark.models || bookmark.models.length === 0) {
                return;
            }
            self.clearAnnotations();
            // TODO: unload models that are not in bookmark
            loadModels(bookmark.models, 0, function () {
                var id;
                var objectStates = bookmark.objects;
                var objectState;
                var visible = [];
                for (id in objectStates) {
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
                        if (objectState.opacity !== undefined) {
                            self.setOpacity(id, objectState.opacity); // FIXME: what if objects already loaded and transparent, but no opacity value here?
                        }
                    }
                }
                var annotationStates = bookmark.annotations;
                for (id in annotationStates) {
                    if (annotationStates.hasOwnProperty(id)) {
                        self.createAnnotation(id, annotationStates[id]);
                    }
                }
                self.hide();
                self.show(visible);
                self.setEyeLookUp(bookmark.lookat.eye, bookmark.lookat.look, bookmark.lookat.up);
            });
        };
    })();

    /**
     * Clears and destroys this viewer.
     */
    this.destroy = function () {
        scene.off(onTick);
        scene.destroy();
        models = {};
        objects = {};
        objectModels = {};
        eulerAngles = {};
        transformable = {};
        translations = {};
        rotations = {};
        scales = {};
        annotations = {};
        objectAnnotations = {};
    };

    function error(msg) {
        console.log(msg);
    }

    this.setBookmark(cfg);
};
