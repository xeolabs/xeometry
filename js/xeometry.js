var xeometry = {};

/**
 * A convenient API for visualizing glTF models on WebGL.
 * @class Viewer
 * @param {Object} [cfg] Configs
 * @param {Function} [cfg.loadModel] Callback fired to load model
 * @param {Function} [cfg.loadedModel] Callback fired when model loaded
 * @param {Function} [cfg.unloadedModel] Callback fired when model unloaded
 * @param {Function} [cfg.contextAttr] WebGL context attributes
 * @example
 *
 * // Create viewer with defaults
 * var viewer = new xeometry.Viewer();
 *
 * // Create viewer that loads via custom loader callback
 * viewer2 = new xeometry.Viewer({
 *     loadModel: function (modelId, src, ok, error) {
 *          var request = new XMLHttpRequest();
 *          request.overrideMimeType("application/json");
 *          request.open('GET', src2, true);
 *          request.onreadystatechange = function () {
 *             if (request.readyState == 4 && // Request finished, response ready
 *                     request.status == "200") { // Status OK
 *                 var json = JSON.parse(request.responseText);
 *                 ok(json, this);
 *             }
 *         };
 *         request.send(null);
 *     },
 *     loadedModel: function(modelId, src, ok) {
 *         console.log("Loaded modelId=" + modelId);
 *         ok(); // Unblock the viewer
 *     },
 *     unloadedModel: function(modelId, src) {
 *         console.log("Unloaded modelId=" + modelId);
 *     }
 * });
 */
xeometry.Viewer = function (cfg) {

    var self = this;

    cfg = cfg || {};

    var loadModel = cfg.loadModel; // Optional callback to load models
    var loadedModel = cfg.loadedModel; // Optional callback to fire after each model is loaded
    var unloadedModel = cfg.unloadedModel; // Optional callback to fire after each model is unloaded

    var scene = new xeogl.Scene({
        canvas: cfg.canvas,
        webgl2: false,
        contextAttr: cfg.contextAttr || {}
        //,
        //transparent: true
    });

    var math = xeogl.math;
    var camera = scene.camera;
    var view = camera.view;

    var types = {}; // List of objects for each type
    var models = {}; // Models mapped to their IDs
    var modelSrcs = {}; // Data ID each model was loaded from
    var objects = {}; // Objects mapped to their IDs
    var annotations = {}; // Annotations mapped to their IDs
    var objectAnnotations = {}; // Annotations for each object
    var eulerAngles = {}; // Euler rotation angles for each model and object
    var rotations = {}; // xeogl.Rotate for each model and object
    var translations = {}; // xeogl.Translate for each model and object
    var scales = {}; // xeogl.Scale for each model and object
    var objectModels = {}; // Model of each object
    var transformable = {}; // True for each model and object that has transforms
    var yspin = 0;
    var xspin = 0;
    var clips = {};
    var clipHelpers = {};
    var clipsDirty = true;

    var onTick = scene.on("tick", function () {

        // Orbit animation
        if (yspin > 0) {
            view.rotateEyeY(yspin);
        }
        if (xspin > 0) {
            view.rotateEyeX(xspin);
        }

        // Rebuild user clip planes
        if (clipsDirty) {
            var clip;
            var clipArray = [];
            for (var id in clips) {
                if (clips.hasOwnProperty(id)) {
                    clip = clips[id];
                    clipArray.push(clip);
                }
            }
            scene.clips.clips = clipArray;
            clipsDirty = false;
        }
    });

    var cameraFlight = new xeogl.CameraFlightAnimation(scene, {
        fitFOV: 45,
        duration: 0.1
    });

    var projections = { // Camera projections to switch between
        perspective: camera.project, // Camera has a xeogl.Perspective by default
        orthographic: new xeogl.Ortho(scene, {
            scale: 1.0,
            near: 0.1,
            far: 5000
        })
    };

    var projectionType = "perspective";

    //var cameraControl = new xeogl.CameraControl(scene);

    //----------------------------------------------------------------------------------------------------
    // Task management
    //----------------------------------------------------------------------------------------------------

    /**
     * Schedules a task for the viewer to run asynchronously at the next opportunity.
     *
     * Internally, this pushes the task to a FIFO queue. Within each frame interval, the viewer pumps the queue
     * for a certain period of time, popping tasks and running them. After each frame interval, tasks that did not
     * get a chance to run during the task are left in the queue to be run next time.
     *
     * @param {Function} callback Callback that runs the task.
     * @param {Object} [scope] Scope for the callback.
     * @returns {Viewer} this
     * @example
     * viewer.scheduleTask(function() { ... });
     * viewer.scheduleTask(function() { this.log("foo"); }, console); // Set a scope for the task
     */
    this.scheduleTask = function (callback, scope) {
        if (!callback) {
            error("scheduleTask() - Missing callback");
            return;
        }
        xeogl.scheduleTask(callback, scope);
        return this;
    };

    /**
     * Gets the viewer's WebGL canvas.
     *
     * @returns {HTMLCanvasElement}
     */
    this.getCanvas = function () {
        return scene.canvas.canvas;
    };

    /**
     * Returns the HTML DIV element that overlays the WebGL canvas.
     *
     * This overlay is for catching mouse navigation events.
     *
     * @returns {HTMLDivElement}
     */
    this.getOverlay = function () {
        return scene.canvas.overlay;
    };

    //==================================================================================================================
    // Models
    //==================================================================================================================

    /**
     * Loads a model into the viewer.
     *
     * Assigns the model an ID, which gets prefixed to the IDs of its objects.
     *
     * @param {String} id ID to assign to the model. This gets prefixed to the IDs of the model's objects.
     * @param {String} src Locates the model. This could be a path to a file or an ID within a database.
     * @param {Function} [ok] Callback fired when model loaded.
     * @return {Viewer} this
     * @example
     * // Load saw model, fit in view, show two of its objects
     * viewer.loadModel("saw", "models/gltf/ReciprocatingSaw/glTF/ReciprocatingSaw.gltf", function () {
     *    viewer.viewFit("saw");
     *    viewer.hide();
     *    viewer.show(["saw#0.1", "saw#0.2"]);
     * });
     */
    this.loadModel = function (id, src, ok) {
        var isFilePath = xeogl._isString(src);
        var model = models[id];
        if (model) {
            if (isFilePath && src === model.src) {
                if (ok) {
                    ok(model.id);
                }
                return this;
            }
            this.unloadModel(id);
        }
        if (scene.components[id]) {
            error("Component with this ID already exists: " + id);
            if (ok) {
                ok(id);
            }
            return this;
        }
        model = new xeogl.GLTFModel(scene, {
            id: id,
            transform: new xeogl.Scale(scene, {
                parent: new xeogl.Quaternion(scene, {
                    parent: new xeogl.Translate(scene)
                })
            })
        });
        models[id] = model;
        modelSrcs[id] = src;
        model.on("loaded", function () {
            var entities = model.types["xeogl.Entity"];
            var object;
            var meta;
            for (var objectId in entities) {
                if (entities.hasOwnProperty(objectId)) {
                    object = entities[objectId];
                    // model.add(object.material = object.material.clone()); // Ensure unique materials
                    objects[objectId] = object;
                    objectModels[objectId] = model;
                    // Register for type
                    meta = object.meta;
                    var type = meta && meta.type ? meta.type : "DEFAULT";
                    var objectsOfType = (types[type] || (types[type] = {}));
                    objectsOfType[objectId] = object;
                }
            }
            if (loadedModel) {
                loadedModel(id, src, function () {
                    if (ok) {
                        ok(id);
                    }
                });
            } else {
                if (ok) {
                    ok(id);
                }
            }
        });
        if (loadModel) {
            loadModel(id, src,
                function (gltf) {
                    var basePath = null;
                    xeogl.GLTFModel.parse(model, gltf, basePath);
                    // model then fires "loaded" once its finished parsing
                },
                function (errMsg) {
                    error("Error loading model: " + errMsg);
                    if (ok) {
                        ok();
                    }
                });
        } else {
            model.src = src;
        }
        return this;
    };

    /**
     * Gets the IDs of the models currently in the viewer.
     *
     * @see loadModel
     * @module models
     * @return {String[]} IDs of the models.
     */
    this.getModels = function () {
        return Object.keys(models);
    };

    /**
     * Gets the source of a model.
     *
     * This is the ````src```` parameter that was given to {@link #loadModel}.
     *
     * @param {String} id ID of the model.
     * @return {String} Model source.
     */
    this.getModelSrc = function (id) {
        var src = modelSrcs[id];
        if (!src) {
            error("Model not found: " + id);
            return null;
        }
        return src;
    };

    /**
     * Gets the ID of an object's model.
     *
     * @param {String} id ID of the object.
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
     * Gets the IDs of the objects belonging to the given models and/or types.
     *
     * Returns the IDs of all objects in the viewer when no arguments are given.
     *
     * @param {String|String[]} [id] ID(s) of model(s) and/or a type(s).
     * @return {String[]} IDs of the objects.
     * @example
     *
     * // Get all objects currently in the viewer
     * var allObjects = viewer.getObjects();
     *
     * // Get IDs of all the objects in the gearbox model
     * var gearboxObjects = viewer.getObjects("gearbox");
     *
     * // Get IDs of the objects in two models
     * var sawAndGearboxObjects = viewer.getObjects(["saw", "gearbox"]);
     *
     * // Get IDs of objects in the gearbox model, plus all objects in viewer that are IFC cable fittings and carriers
     * var gearboxCableFittings = viewer.getObjects("gearbox", "IfcCableFitting", "IfcCableCarrierFitting"]);
     */
    this.getObjects = function (id) {
        if (id === undefined || id === null) {
            return Object.keys(objects);
        }
        if (xeogl._isString(id)) {
            var object = objects[id];
            if (object) {
                return [id];
            }
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
        if (xeogl._isArray(id)) {
            var result = [];
            var got = {};
            for (var i = 0; i < id.length; i++) {
                var buf = this.getObjects(id[i]);
                for (var j = 0; j < buf.length; j++) {
                    var id2 = buf[j];
                    if (!got[id2]) {
                        got[id2] = true;
                        result.push(id2);
                    }
                }
            }
            return result;
        }
        return [];
    };

    /**
     * Unloads a model.
     *
     * @see {@link #loadModel}
     * @param {String} id ID of the model.
     * @return {Viewer} this
     * @example viewer.unloadModel("saw");
     */
    this.unloadModel = function (id) {
        var model = models[id];
        if (!model) {
            error("Model not found: " + id);
            return this;
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
        delete modelSrcs[id];
        delete eulerAngles[id];
        if (unloadedModel) {
            unloadedModel(id);
        }
        return this;
    };

    /**
     * Unloads all models, annotations and clipping planes.
     *
     * Preserves the current camera state.
     *
     * @return {Viewer} this
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
     * Assigns a type to an object.
     *
     * A type can be anything, but when using xeometry as an IFC viewer, it's typically an IFC type.
     *
     * @param {String} id ID of an object.
     * @param {String} type The type.
     * @returns {Viewer} this
     * @example
     * viewer.setType("saw#1.1", "cover");
     */
    this.setType = function (id, type) {
        type = type || "DEFAULT";
        var object = objects[id];
        if (object) {
            var meta = object.meta;
            var currentType = meta && meta.type ? meta.type : "DEFAULT";
            if (currentType === type) {
                return this;
            }
            var currentTypes = types[currentType];
            if (currentTypes) {
                delete currentTypes[id];
            }
            var newTypes = (types[type] || (types[type] = {}));
            newTypes[id] = object;
            object.meta.type = type;
            return this;
        }
        var model = models[id];
        if (model) {
            //.. TODO
            return this;
        }
        error("Model, object or type not found: " + id);
        return this;
    };

    /**
     * Gets the type of an object.
     *
     * @param {String} id ID of the object.
     * @returns {String} The type of the object.
     * @example
     * var type = viewer.getType("saw#1.1");
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
     * Gets all the types currently in the viewer.
     *
     * @return {String[]} The types in the viewer.
     */
    this.getTypes = function () {
        return Object.keys(types);
    };

    //==================================================================================================================
    // Geometry
    //==================================================================================================================

    /**
     * Gets the geometry primitive type of an object.
     *
     * This determines the layout of the indices array of the object's geometry.
     *
     * @param {String} id ID of the object.
     * @returns {String} The primitive type. Possible values are 'points', 'lines', 'line-loop',
     * 'line-strip', 'triangles', 'triangle-strip' and 'triangle-fan'.
     * @example
     * var prim = viewer.getPrimitive("saw#1.1");
     */
    this.getPrimitive = function (id) {
        var object = objects[id];
        if (object) {
            return object.geometry.primitive;
        }
        error("Object not found: " + id);
    };

    /**
     * Gets the World-space geometry vertex positions of an object.
     *
     * @param {String} id ID of the object.
     * @returns {Float32Array} The vertex positions.
     * @example
     * var positions = viewer.getPositions("saw#1.1");
     */
    this.getPositions = function (id) {
        var object = objects[id];
        if (object) {
            return object.positions;
        }
        error("Object not found: " + id);
    };

    /**
     * Gets the geometry primitive indices of an object.
     *
     * @param {String} id ID of the object.
     * @returns {Int32Array} The indices.
     * @example
     * var indices = viewer.getIndices("saw#1.1");
     */
    this.getIndices = function (id) {
        var object = objects[id];
        if (object) {
            return object.geometry.indices;
        }
        error("Object not found: " + id);
    };

    //==================================================================================================================
    // Transformation
    //==================================================================================================================

    /**
     * Sets the scale of a model or an object.
     *
     * An object's scale is relative to its model's scale. For example, if an object has a scale
     * of ````[0.5, 0.5, 0.5]```` and its model also has scale ````[0.5, 0.5, 0.5]````, then the object's
     * effective scale is ````[0.25, 0.25, 0.25]````.
     *
     * A model or object's scale is ````[1.0, 1.0, 1.0]```` by default.
     *
     * @param {String} id ID of a model or object.
     * @param {[Number, Number, Number]} xyz Scale factors for the X, Y and Z axis.
     * @returns {Viewer} this
     * @example
     * viewer.setScale("saw", [1.5, 1.5, 1.5]);
     * viewer.setScale("saw#1.1", [0.5, 0.5, 0.5]);
     */
    this.setScale = function (id, xyz) {
        var scale = scales[id];
        if (!scale) {
            var component = getTransformableComponent(id);
            if (!component) {
                error("Model or object not found: " + id);
                return this;
            }
            scale = scales[id];
        }
        scale.xyz = xyz;
        return this;
    };

    /**
     * Gets the scale of a model or an object.
     *
     * An object's scale is relative to its model's scale. For example, if an object has a scale
     * of ````[0.5, 0.5, 0.5]```` and its model also has scale ````[0.5, 0.5, 0.5]````, then the object's
     * effective scale is ````[0.25, 0.25, 0.25]````.
     *
     * A model or object's scale is ````[1.0, 1.0, 1.0]```` by default.
     *
     * @param {String} id ID of a model or object.
     * @return {[Number, Number, Number]} Scale factors for the X, Y and Z axis.
     * @example
     * var sawScale = viewer.getScale("saw");
     * var sawCoverScale = viewer.getScale("saw#1.1");
     */
    this.getScale = function (id) {
        var scale = scales[id];
        if (!scale) {
            var component = getTransformableComponent(id);
            if (!component) {
                error("Model or object not found: " + id);
                return this;
            }
            scale = scales[id];
        }
        return scale.xyz.slice();
    };

    /**
     * Sets the rotation of a model or an object.
     *
     * An object's rotation is relative to its model's rotation. For example, if an object has a rotation
     * of ````45```` degrees about the Y axis, and its model also has a rotation of ````45```` degrees about
     * Y, then the object's effective rotation is ````90```` degrees about Y.
     *
     * Rotations are in order of X, Y then Z.
     *
     * The rotation angles of each model or object are ````[0, 0, 0]```` by default.
     *
     * @param {String} id ID of a model or object.
     * @param {[Number, Number, Number]} xyz Rotation angles, in degrees, for the X, Y and Z axis.
     * @returns {Viewer} this
     * @example
     * viewer.setRotate("saw", [90, 0, 0]);
     * viewer.setRotate("saw#1.1", [0, 35, 0]);
     */
    this.setRotate = (function () {
        var quat = math.vec4();
        return function (id, xyz) {
            var rotation = rotations[id];
            if (!rotation) {
                var component = getTransformableComponent(id);
                if (!component) {
                    error("Model or object not found: " + id);
                    return this;
                }
                rotation = rotations[id];
            }
            math.eulerToQuaternion(xyz, "XYZ", quat); // Tait-Bryan Euler angles
            rotation.xyzw = quat;
            var saveAngles = eulerAngles[id] || (eulerAngles[id] = math.vec3());
            saveAngles.set(xyz);
            return this;
        };
    })();

    /**
     * Gets the rotation of a model or an object.
     *
     * An object's rotation is relative to its model's rotation. For example, if an object has a rotation
     * of ````45```` degrees about the Y axis, and its model also has a rotation of ````45```` degrees about
     * Y, then the object's effective rotation is ````90```` degrees about Y.
     *
     * The rotation angles of each model or object are ````[0, 0, 0]```` by default.
     *
     * Rotations are in order of X, Y then Z.
     *
     * @param {String} id ID of a model or object.
     * @return {[Number, Number, Number]} Rotation angles, in degrees, for the X, Y and Z axis.
     * @example
     * var sawRotate = viewer.getRotate("saw");
     * var sawCoverRotate = viewer.getRotate("saw#1.1");
     */
    this.getRotate = function (id) {
        var component = getTransformableComponent(id);
        if (!component) {
            error("Model or object not found: " + id);
            return 0;
        }
        var angles = eulerAngles[id];
        return angles ? angles.slice() : math.vec3([0, 0, 0]);
    };

    /**
     * Sets the translation of a model or an object.
     *
     * An object's translation is relative to that of its model. For example, if an object has a translation
     * of ````[100, 0, 0]```` and its model has a translation of ````[50, 50, 50]```` , then the object's effective
     * translation is ````[150, 50, 50]````.
     *
     * The translation of each model or object is ````[0, 0, 0]```` by default.
     *
     * @param {String} id ID of a model or object.
     * @param {[Number, Number, Number]} xyz World-space translation vector.
     * @returns {Viewer} this
     * @example
     * viewer.setTranslate("saw", [100, 30, 0]);
     * viewer.setTranslate("saw#1.1", [50, 30, 0]);
     */
    this.setTranslate = function (id, xyz) {
        var translation = translations[id];
        if (!translation) {
            var component = getTransformableComponent(id);
            if (!component) {
                error("Model or object not found: " + id);
                return this;
            }
            translation = translations[id];
        }
        translation.xyz = xyz;
        return this;
    };

    /**
     * Increments or decrements the translation of a model or an object.
     *
     * @param {String} id ID of a model or object.
     * @param {[Number, Number, Number]} xyz World-space translation vector.
     * @returns {Viewer} this
     * @example
     * viewer.addTranslate("saw", [10,0,0]);
     * viewer.addTranslate("saw#1.1", [10,0,0]);
     */
    this.addTranslate = function (id, xyz) {
        var translation = translations[id];
        if (!translation) {
            var component = getTransformableComponent(id);
            if (!component) {
                error("Model or object not found: " + id);
                return this;
            }
            translation = translations[id];
        }
        var xyzOld = translation.xyz;
        translation.xyz = [xyzOld[0] + xyz[0], xyzOld[1] + xyz[1], xyzOld[2] + xyz[2]];
        return this;
    };

    /**
     * Gets the translation of a model or an object.
     *
     * An object's translation is relative to that of its model. For example, if an object has a translation
     * of ````[100, 0, 0]```` and its model has a translation of ````[50, 50, 50]```` , then the object's effective
     * translation is ````[150, 50, 50]````.
     *
     * The translation of each model or object is ````[0, 0, 0]```` by default.
     *
     * @param {String} id ID of a model or an object.
     * @return {[Number, Number, Number]} World-space translation vector.
     * @example
     * var sawTranslate = viewer.getTranslate("saw");
     * var sawCoverTranslate = viewer.getTranslate("saw#1.1");
     */
    this.getTranslate = function (id) {
        var translation = translations[id];
        if (!translation) {
            var component = getTransformableComponent(id);
            if (!component) {
                error("Model or object not found: " + id);
                return 0;
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

    //==================================================================================================================
    // Visibility
    //==================================================================================================================

    /**
     * Shows model(s) and/or object(s).
     *
     * Shows all objects in the viewer when no arguments are given.
     *
     * Objects are visible by default.
     *
     * @example viewer.show(); // Show all objects in the viewer
     * @param {String|String[]} [ids] IDs of model(s) and/or object(s).
     * @returns {Viewer} this
     * @example
     *
     * // Show all objects in the viewer
     * viewer.show();
     *
     * // Show all objects in models "saw" and "gearbox"
     * viewer.show(["saw", "gearbox"]);
     *
     * // Show two objects in model "saw", plus all objects in model "gearbox"
     * viewer.show(["saw#0.1", "saw#0.2", "gearbox"]);
     *
     * // Show objects in the model "gearbox", plus all objects in viewer that are IFC cable fittings and carriers
     * viewer.show("gearbox", "IfcCableFitting", "IfcCableCarrierFitting"]);
     */
    this.show = function (ids) {
        setVisible(ids, true);
        return this;
    };

    /**
     * Hides model(s) and/or object(s).
     *
     * Hides all objects in the viewer when no arguments are given.
     *
     * Objects are visible by default.
     *
     * @param {String|String[]} ids IDs of model(s) and/or object(s).
     * @returns {Viewer} this
     * @example
     *
     * // Hide all objects in the viewer
     * viewer.hide();
     *
     * // Hide all objects in models "saw" and "gearbox"
     * viewer.hide(["saw", "gearbox"]);
     *
     * // Hide two objects in model "saw", plus all objects in model "gearbox"
     * viewer.hide(["saw#0.1", "saw#0.2", "gearbox"]);
     *
     * // Hide objects in the model "gearbox", plus all objects in viewer that are IFC cable fittings and carriers
     * viewer.hide("gearbox", "IfcCableFitting", "IfcCableCarrierFitting"]);
     */
    this.hide = function (ids) {
        setVisible(ids, false);
        return this;
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
                object.visible = visible;
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

    //==================================================================================================================
    // Opacity
    //==================================================================================================================

    /**
     * Sets the opacity of model(s), object(s) and/or type(s).
     *
     * @param {String|String[]} ids IDs of models, objects or types. Sets opacity of all objects when this is null or undefined.
     * @param {Number} opacity Degree of opacity in range ````[0..1]````.
     * @returns {Viewer} this
     * @example
     * // Create an X-ray view of two objects in the "saw" model
     * viewer.setOpacity("saw", 0.4);
     * viewer.setOpacity(["saw#0.1", "saw#0.2"], 1.0);
     */
    this.setOpacity = function (ids, opacity) {
        if (opacity === null || opacity === undefined) {
            opacity = 1.0;
        }
        if (ids === undefined || ids === null) {
            self.setOpacity(self.getObjects(), opacity);
            return this;
        }
        if (xeogl._isString(ids)) {
            var id = ids;
            var object = objects[id];
            if (object) {
                object.material.alphaMode = (opacity < 1) ? "blend" : "opaque";
                object.material.alpha = opacity;
                return;
            }
            var model = models[id];
            if (!model) {
                var objectsOfType = types[id];
                if (objectsOfType) {
                    var typeIds = Object.keys(objectsOfType);
                    if (typeIds.length === 0) {
                        return this;
                    }
                    self.setOpacity(typeIds, opacity);
                    return this;
                }
                error("Model, object or type not found: " + id);
                return this;
            }
            self.setOpacity(self.getObjects(id), opacity);
            return this;
        }
        for (var i = 0, len = ids.length; i < len; i++) {
            self.setOpacity(ids[i], opacity);
        }
        return this;
    };

    /**
     * Gets the opacity of an object.
     *
     * @param {String|String} id ID of an object.
     * @return {Number} Degree of opacity in range [0..1].
     * @example
     * var sawObjectOpacity = viewer.getOpacity("saw#0.1");
     */
    this.getOpacity = function (id) {
        var object = objects[id];
        if (!object) {
            error("Model, object or type not found: " + id);
            return 1.0;
        }
        return object.material.alpha;
    };

    //==================================================================================================================
    // Color
    //==================================================================================================================

    /**
     * Sets the albedo color of model(s) and/or object(s).
     *
     * @param {String|String[]} ids IDs of models, objects or types. Applies to all objects when this is null or undefined.
     * @param {[Number, Number, Number]} color The RGB color, with each element in range [0..1].
     * @returns {Viewer} this
     * @example
     * viewer.setColor("saw", [1,0,0]); // Set all objects in saw model red
     * viewer.setColor(["saw#0.1", "saw#0.2"], [0,1,0]); // Set two objects in saw model green
     */
    this.setColor = function (ids, color) {
        if (color === null || color === undefined) {
            color = 1.0;
        }
        if (ids === undefined || ids === null) {
            self.setColor(self.getObjects(), color);
            return this;
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
                return this;
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
                    return this;
                }
                error("Model, object or type not found: " + id);
                return this;
            }
            self.setColor(self.getObjects(id), color);
            return this;
        }
        for (var i = 0, len = ids.length; i < len; i++) {
            self.setColor(ids[i], color);
        }
        return this;
    };

    /**
     * Gets the color of an object.
     *
     * @param {String|String} id ID of an object.
     * @return {[Number, Number, Number]} color The RGB color of the object, with each element in range [0..1].
     * @example
     * var objectColor = viewer.getColor("saw#1.1");
     */
    this.getColor = function (id) {
        var object = objects[id];
        if (!object) {
            error("Model, object or type not found: " + id);
            return [1, 1, 1];
        }
        var material = object.material;
        var color = material.diffuse || material.baseColor || [1, 1, 1]; // PhongMaterial || SpecularMaterial || MetallicMaterial
        return color.slice();
    };

    //==================================================================================================================
    // Clippability
    //==================================================================================================================

    /**
     * Makes model(s) and/or object(s) clippable.
     *
     * Makes all objects in the viewer clippable when no arguments are given.
     *
     * Objects are clippable by default.
     *
     * @param {String|String[]} [ids] IDs of model(s) and/or object(s).
     * @returns {Viewer} this
     * @example
     *
     * // Make all objects in the viewer clippable
     * viewer.setClippable();
     *
     * // Make all objects in models "saw" and "gearbox" clippable
     * viewer.setClippable(["saw", "gearbox"]);
     *
     * // Make two objects in model "saw" clippable, plus all objects in model "gearbox"
     * viewer.setClippable(["saw#0.1", "saw#0.2", "gearbox"]);
     *
     * // Make objects in the model "gearbox" clippable, plus all objects in viewer that are IFC cable fittings and carriers
     * viewer.setClippable("gearbox", "IfcCableFitting", "IfcCableCarrierFitting"]);
     */
    this.setClippable = function (ids) {
        setClippable(ids, true);
        return this;
    };

    /**
     * Makes model(s) and/or object(s) unclippable.
     *
     * These objects will then remain fully visible when they would otherwise be clipped by clipping planes.
     *
     * Makes all objects in the viewer unclippable when no arguments are given.
     *
     * Objects are clippable by default.
     *
     * @param {String|String[]} ids IDs of model(s) and/or object(s).
     * @returns {Viewer} this
     * @example
     *
     * // Make all objects in the viewer unclippable
     * viewer.setUnclippable();
     *
     * // Make all objects in models "saw" and "gearbox" unclippable
     * viewer.setUnclippable(["saw", "gearbox"]);
     *
     * // Make two objects in model "saw" unclippable, plus all objects in model "gearbox"
     * viewer.setUnclippable(["saw#0.1", "saw#0.2", "gearbox"]);
     *
     * // Make all objects in the model "gearbox" unclippable, plus all objects in viewer that are IFC cable fittings and carriers
     * viewer.setUnclippable("gearbox", "IfcCableFitting", "IfcCableCarrierFitting"]);
     */
    this.setUnclippable = function (ids) {
        setClippable(ids, false);
        return this;
    };

    function setClippable(ids, clippable) {
        if (ids === undefined || ids === null) {
            setClippable(self.getObjects(), clippable);
            return;
        }
        if (xeogl._isString(ids)) {
            var id = ids;
            var object = objects[id];
            if (object) {
                object.clippable = clippable;
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
                    setClippable(typeIds, clippable);
                    return
                }
                error("Model, object or type not found: " + id);
                return;
            }
            setClippable(self.getObjects(id), clippable);
            return;
        }
        for (var i = 0, len = ids.length; i < len; i++) {
            setClippable(ids[i], clippable);
        }
    }

    //----------------------------------------------------------------------------------------------------
    // Outlines
    //----------------------------------------------------------------------------------------------------

    /**
     * Sets the current outline thickness.
     * @param {Number} thickness Thickness in pixels.
     * @returns {Viewer} this
     * @example
     * viewer.setOutlineThickness(3);
     */
    this.setOutlineThickness = function (thickness) {
        scene.outline.thickness = thickness;
        return this;
    };

    /**
     * Gets the current outline thickness.
     * @return {Number} Thickness in pixels.
     */
    this.getOutlineThickness = function () {
        return scene.outline.thickness;
    };

    /**
     * Sets the current outline color.
     * @param {[Number, Number, Number]} color RGB color as a value per channel, in range [0..1].
     * @returns {Viewer} this
     * @example
     * viewer.setOutlineColor([1,0,0]);
     */
    this.setOutlineColor = function (color) {
        scene.outline.color = color;
        return this;
    };

    /**
     * Returns the current outline color.
     * @return {[Number, Number, Number]} RGB color as a value per channel, in range [0..1].
     */
    this.getOutlineColor = function () {
        return scene.outline.color;
    };

    /**
     * Shows outline around model(s), object(s) or type(s).
     *
     * Outlines all objects in the viewer when no arguments are given.
     *
     * @param {String|String[]} ids IDs of model(s) and/or object(s). Outlines all objects by default.
     * @returns {Viewer} this
     * @example
     * viewer.showOutline(); // Show outline around all objects in viewer
     * viewer.showOutline("saw"); // Show outline around all objects in saw model
     * viewer.showOutline(["saw#0.1", "saw#0.2"]); // Show outline around two objects in saw model
     */
    this.showOutline = function (ids) {
        setOutline(ids, true);
        return this;
    };

    /**
     * Hides outline around model(s), object(s) or type(s).
     *
     * Hides all outlines in the viewer when no arguments are given.
     *
     * @param {String|String[]} ids IDs of model(s) and/or object(s).
     * @returns {Viewer} this
     * @example
     * viewer.hideOutline(); // Hide outline around all objects in viewer
     * viewer.hideOutline("saw"); // Hide outline around all objects in saw model
     * viewer.hideOutline(["saw#0.1", "saw#0.2"]); // Hide outline around two objects in saw model
     */
    this.hideOutline = function (ids) {
        setOutline(ids, false);
        return this;
    };

    function setOutline(ids, outline) {
        if (ids === undefined || ids === null) {
            setOutline(self.getObjects(), outline);
            return this;
        }
        if (xeogl._isString(ids)) {
            var id = ids;
            var object = objects[id];
            if (object) {
                object.outlined = outline;
                return this;
            }
            var model = models[id];
            if (!model) {
                var objectsOfType = types[id];
                if (objectsOfType) {
                    var typeIds = Object.keys(objectsOfType);
                    if (typeIds.length === 0) {
                        return this;
                    }
                    setOutline(typeIds, outline);
                    return
                }
                error("Model, object or type not found: " + id);
                return this;
            }
            setOutline(self.getObjects(id), outline);
            return this;
        }
        for (var i = 0, len = ids.length; i < len; i++) {
            setOutline(ids[i], outline);
        }
        return this;
    }

    //----------------------------------------------------------------------------------------------------
    // Boundaries
    //----------------------------------------------------------------------------------------------------

    /**
     * Gets the World-space center point of the given model(s), object(s) or type(s).
     *
     * When no arguments are given, returns the collective center of all objects in the viewer.
     *
     * @param {String|String[]} target IDs of models and/or objects.
     * @returns {[Number, Number, Number]} The World-space center point.
     * @example
     * viewer.getCenter(); // Gets collective center of all objects in the viewer
     * viewer.getCenter("saw"); // Gets collective center of all objects in saw model
     * viewer.getCenter(["saw", "gearbox"]); // Gets collective center of all objects in saw and gearbox models
     * viewer.getCenter("saw#0.1"); // Get center of an object in the saw model
     * viewer.getCenter(["saw#0.1", "saw#0.2"]); // Get collective center of two objects in saw model
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
     * Gets the axis-aligned World-space boundary of the given model(s), object(s) or type(s).
     *
     * When no arguments are given, returns the collective boundary of all objects in the viewer.
     *
     * @param {String|String[]} target IDs of models, objects and/or annotations
     * @returns {[Number, Number, Number, Number, Number, Number]} An axis-aligned World-space bounding box, given as elements ````[xmin, ymin, zmin, xmax, ymax, zmax]````.
     * @example
     * viewer.getAABB(); // Gets collective boundary of all objects in the viewer
     * viewer.getAABB("saw"); // Gets collective boundary of all objects in saw model
     * viewer.getAABB(["saw", "gearbox"]); // Gets collective boundary of all objects in saw and gearbox models
     * viewer.getAABB("saw#0.1"); // Get boundary of an object in the saw model
     * viewer.getAABB(["saw#0.1", "saw#0.2"]); // Get collective boundary of two objects in saw model
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
     * Sets the field-of-view (FOV) angle for perspective projection.
     * @param {Number} fov Field-of-view angle, in degrees, on Y-axis.
     * @returns {Viewer} this
     */
    this.setPerspectiveFOV = function (fov) {
        projections.perspective.fovy = fov;
        return this;
    };

    /**
     * Gets the field-of-view (FOV) angle for perspective projection.
     * @return  {Number} Field-of-view angle, in degrees, on Y-axis.
     */
    this.getPerspectiveFOV = function () {
        return projections.perspective.fovy;
    };

    /**
     * Sets the position of the near plane on the View-space Z-axis for perspective projection.
     * @param {Number} near Position of the near plane on the View-space Z-axis.
     * @returns {Viewer} this
     */
    this.setPerspectiveNear = function (near) {
        projections.perspective.near = near;
        return this;
    };

    /**
     * Gets the position of the near plane on the View-space Z-axis for perspective projection.
     * @return  {Number} Position of the near clipping plane on the View-space Z-axis.
     */
    this.getPerspectiveNear = function () {
        return projections.perspective.near;
    };

    /**
     * Sets the position of the far clipping plane on the View-space Z-axis for perspective projection.
     * @param {Number} far Position of the far clipping plane on the View-space Z-axis.
     * @returns {Viewer} this
     */
    this.setPerspectiveFar = function (far) {
        projections.perspective.far = far;
        return this;
    };

    /**
     * Gets the position of the far clipping plane on the View-space Z-axis for perspective projection.
     * @return  {Number} Position of the far clipping plane on the View-space Z-axis.
     */
    this.getPerspectiveFar = function () {
        return projections.perspective.far;
    };

    /**
     * Sets the orthographic projection boundary scale on X and Y axis.
     *
     * This specifies how many units fit within the current orthographic boundary extents.
     *
     * @param {Number} scale The scale factor.
     * @returns {Viewer} this
     */
    this.setOrthoScale = function (scale) {
        projections.orthographic.scale = scale;
        return this;
    };

    /**
     * Gets the orthographic projection boundary scale.
     *
     * This specifies how many units fit within the current orthographic boundary extents.
     *
     * @return  {Number} The scale factor.
     */
    this.getOrthoScale = function () {
        return projections.orthographic.scale;
    };

    /**
     * Sets the position of the near plane on the View-space Z-axis for orthographic projection.
     *
     * @param {Number} near Position of the near plane on the View-space Z-axis.
     * @returns {Viewer} this
     */
    this.setOrthoNear = function (near) {
        projections.orthographic.near = near;
        return this;
    };

    /**
     * Gets the position of the near plane on the View-space Z-axis for orthographic projection.
     *
     * @return  {Number} Position of the near clipping plane on the View-space Z-axis.
     */
    this.getOrthoNear = function () {
        return projections.orthographic.near;
    };

    /**
     * Sets the position of the far clipping plane on the View-space Z-axis for orthographic projection.
     *
     * @param {Number} far Position of the far clipping plane on the View-space Z-axis.
     * @returns {Viewer} this
     */
    this.setOrthoFar = function (far) {
        projections.orthographic.far = far;
    };

    /**
     * Gets the position of the far clipping plane on the View-space Z-axis for orthographic projection.
     *
     * @return  {Number} Position of the far clipping plane on the View-space Z-axis.
     */
    this.getOrthoFar = function () {
        return projections.orthographic.far;
    };

    /**
     * Sets the camera's current projection type.
     *
     * Options are "perspective" and "ortho". You can set properties for either of these, regardless
     * of whether they are currently active or not.
     *
     * @param {String} type Either "perspective" or "ortho".
     * @returns {Viewer} this
     */
    this.setProjection = function (type) {
        if (projectionType === type) {
            return;
        }
        var projection = projections[type];
        if (!projection) {
            error("Unsupported camera projection type: " + type);
        } else {
            camera.project = projection;
            projectionType = type;
        }
        return this;
    };

    /**
     * Gets the camera's current projection type.
     *
     * @return {String} Either "perspective" or "ortho".
     */
    this.getProjection = function () {
        return projectionType;
    };

    /**
     * Sets the camera viewpoint.
     *
     * @param {[Number, Number, Number]} eye The new viewpoint.
     * @returns {Viewer} this
     */
    this.setEye = function (eye) {
        view.eye = eye;
        return this;
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
     * @returns {Viewer} this
     */
    this.setLook = function (look) {
        view.look = look;
        return this;
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
     * @returns {Viewer} this
     */
    this.setUp = function (up) {
        view.up = up;
        return this;
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
     * Sets the camera's pose, which consists of eye position, point-of-interest and "up" vector.
     *
     * @param {[Number, Number, Number]} eye Camera's new viewpoint.
     * @param {[Number, Number, Number]} look Camera's new point-of-interest.
     * @param {[Number, Number, Number]} up Camera's new up direction.
     * @returns {Viewer} this
     */
    this.setEyeLookUp = function (eye, look, up) {
        view.eye = eye;
        view.look = look;
        view.up = up || [0, 1, 0];
        return this;
    };

    /**
     * Locks the camera's vertical rotation axis to the World-space Y axis.
     * @returns {Viewer} this
     */
    this.lockGimbalY = function () {
        view.gimbalLockY = true;
        return this;
    };

    /**
     * Allows camera yaw rotation around the camera's "up" vector.
     * @returns {Viewer} this
     */
    this.unlockGimbalY = function () {
        view.gimbalLockY = false;
        return this;
    };

    /**
     * Rotates the camera's 'eye' position about its 'look' position, around the 'up' vector.
     * @param {Number} angle Angle of rotation in degrees
     * @returns {Viewer} this
     */
    this.rotateEyeY = function (angle) {
        view.rotateEyeY(angle);
        return this;
    };

    /**
     * Rotates the camera's 'eye' position about its 'look' position, pivoting around its X-axis.
     * @param {Number} angle Angle of rotation in degrees
     * @returns {Viewer} this
     */
    this.rotateEyeX = function (angle) {
        view.rotateEyeX(angle);
        return this;
    };

    /**
     * Rotates the camera's 'look' position about its 'eye' position, pivoting around its 'up' vector.
     *
     * @param {Number} angle Angle of rotation in degrees
     * @returns {Viewer} this
     */
    this.rotateLookY = function (angle) {
        view.rotateLookY(angle);
        return this;
    };

    /**
     * Rotates the camera's 'eye' position about its 'look' position, pivoting around its X-axis.
     *
     * @param {Number} angle Angle of rotation in degrees
     * @returns {Viewer} this
     */
    this.rotateLookX = function (angle) {
        view.rotateLookX(angle);
        return this;
    };

    /**
     * Pans the camera along its local X, Y or Z axis.
     * @param {[Number, Number, Number]} pan The pan vector
     * @returns {Viewer} this
     */
    this.pan = function (pan) {
        view.pan(pan);
        return this;
    };

    /**
     * Increments/decrements the camera's zoom distance, ie. distance between eye and look.
     * @param {Number} delta The zoom increment.
     * @returns {Viewer} this
     */
    this.zoom = function (delta) {
        view.zoom(delta);
        return this;
    };

    /**
     * Sets the camera's flight duration when fitting elements to view.
     *
     * A value of zero (default) will cause the camera to instantly jump to each new target .
     *
     * @param {Number} value The new flight duration, in seconds.
     * @returns {Viewer} this
     */
    this.setViewFitDuration = function (value) {
        cameraFlight.duration = value;
        return this;
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
     * @returns {Viewer} this
     */
    this.setViewFitFOV = function (value) {
        cameraFlight.fitFOV = value;
        return this;
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
     * Moves the camera to fit the given annotation(s), model(s), object(s) and/or boundary(s).
     *
     * Preserves the direction that the camera is currently pointing in.
     *
     * A boundary is an axis-aligned World-space bounding box, given as elements ````[xmin, ymin, zmin, xmax, ymax, zmax]````.
     *
     * @param {String|[]} target The elements to fit in view, given as either the ID of an annotation, model or object, a boundary, or an array containing mixture of IDs and boundaries.
     * @param {Function} [ok] Callback fired when camera has arrived at its target position.
     * @returns {Viewer} this
     */
    this.viewFit = function (target, ok) {
        if (xeogl._isString(target)) {
            var annotation = annotations[target];
            if (annotation) {
                if (ok || cameraFlight.duration > 0.1) {
                    cameraFlight.flyTo({eye: annotation.eye, look: annotation.look, up: annotation.up}, ok);
                } else {
                    cameraFlight.jumpTo({eye: annotation.eye, look: annotation.look, up: annotation.up});
                }
                return this;
            }
        }
        if (ok || cameraFlight.duration > 0.1) {
            cameraFlight.flyTo({aabb: this.getAABB(target)}, ok);
        } else {
            cameraFlight.jumpTo({aabb: this.getAABB(target)});
        }
        return this;
    };

    /**
     * Moves the camera to fit the given model(s), object(s) and/or boundary(s) in view, while looking along the +X axis.
     *
     * @param {String|[]} target The element(s) to fit in view, given as either the ID of model, ID of object, a boundary, or an array containing mixture of IDs and boundaries.
     * @param {Function} [ok] Callback fired when camera has arrived at its target position.
     * @returns {Viewer} this
     */
    this.viewFitRight = function (target, ok) {
        viewFitAxis(target, 0, ok);
        return this;
    };

    /**
     * Moves the camera to fit the given model(s), object(s) and/or boundary(s) in view, while looking along the +Z axis.
     *
     * @param {String|[]} target The element(s) to fit in view, given as either the ID of model, ID of object, a boundary, or an array containing mixture of IDs and boundaries.
     * @param {Function} [ok] Callback fired when camera has arrived at its target position.
     * @returns {Viewer} this
     */
    this.viewFitBack = function (target, ok) {
        viewFitAxis(target, 1, ok);
        return this;
    };

    /**
     * Moves the camera to fit the given model(s), object(s) and/or boundary(s) in view, while looking along the -X axis.
     *
     * @param {String|[]} target The element(s) to fit in view, given as either the ID of model, ID of object, a boundary, or an array containing mixture of IDs and boundaries.
     * @param {Function} [ok] Callback fired when camera has arrived at its target position.
     * @returns {Viewer} this
     */
    this.viewFitLeft = function (target, ok) {
        viewFitAxis(target, 2, ok);
        return this;
    };

    /**
     * Moves the camera to fit the given model(s), object(s) and/or boundary(s) in view, while looking along the +X axis.
     *
     * @param {String|[]} target The element(s) to fit in view, given as either the ID of model, ID of object, a boundary, or an array containing mixture of IDs and boundaries.
     * @param {Function} [ok] Callback fired when camera has arrived at its target position.
     * @returns {Viewer} this
     */
    this.viewFitFront = function (target, ok) {
        viewFitAxis(target, 3, ok);
        return this;
    };

    /**
     * Moves the camera to fit the given model(s), object(s) and/or boundary(s) in view, while looking along the -Y axis.
     *
     * @param {String|[]} target The element(s) to fit in view, given as either the ID of model, ID of object, a boundary, or an array containing mixture of IDs and boundaries.
     * @param {Function} [ok] Callback fired when camera has arrived at its target position.
     * @returns {Viewer} this
     */
    this.viewFitTop = function (target, ok) {
        viewFitAxis(target, 4, ok);
        return this;
    };

    /**
     * Moves the camera to fit the given model(s), object(s) and/or boundary(s) in view, while looking along the +X axis.
     *
     * @param {String|[]} target The element(s) to fit in view, given as either the ID of model, ID of object, a boundary, or an array containing mixture of IDs and boundaries.
     * @param {Function} [ok] Callback fired when camera has arrived at its target position.
     * @returns {Viewer} this
     */
    this.viewFitBottom = function (target, ok) {
        viewFitAxis(target, 5, ok);
        return this;
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
                        eye: [center[0], center[1], center[2] - dist],
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
                        eye: [center[0], center[1], center[2] + dist],
                        up: [0, 1, 0]
                    };
                    break;
                case 4: // Top view
                    cameraTarget = {
                        look: center,
                        eye: [center[0], center[1] + dist, center[2]],
                        up: [0, 0, 1]
                    };
                    break;
                case 5: // Bottom view
                    cameraTarget = {
                        look: center,
                        eye: [center[0], center[1] - dist, center[2]],
                        up: [0, 0, -1]
                    };
                    break;
            }
            if (ok || cameraFlight.duration > 0) {
                cameraFlight.flyTo(cameraTarget, ok);
            } else {
                cameraFlight.jumpTo(cameraTarget);
            }
            return this;
        };
    })();

    /**
     * Sets the camera's 'eye' position orbiting its 'look' position, pivoting
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
     * Sets the camera's 'eye' position orbiting about its 'look' position, pivoting
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
     * Picks the first object that intersects the given ray.
     *
     * @param {[Number, Number, Number]} origin World-space ray origin.
     * @param {[Number, Number, Number]} dir World-space ray direction vector.
     * @returns {{id: String}} If object found, a hit record containing the ID of the object, else null.
     * @example
     * var hit = viewer.rayCastObject([0,0,-5], [0,0,1]);
     * if (hit) {
     *      var objectId = hit.id;
     * }
     */
    this.rayCastObject = function (origin, dir) {
        var hit = scene.pick({origin: origin, direction: dir, pickSurface: false});
        if (hit) {
            return {id: hit.entity.id};
        }
    };

    /**
     * Picks the first object that intersects the given ray, along with geometric information about
     * the ray-object intersection.
     *
     * @param {[Number, Number, Number]} origin World-space ray origin.
     * @param {[Number, Number, Number]} dir World-space ray direction vector.
     * @returns {{id: String, worldPos: [number,number,number], primIndex:number, bary: [number,number,number]}} If object
     * found, a hit record containing the ID of object, World-space 3D surface intersection, primitive index and
     * barycentric coordinates, else null.
     * @example
     * var hit = viewer.rayCastSurface([0,0,-5], [0,0,1]);
     * if (hit) {
     *      var objectId = hit.id;
     *      var primitive = hit.primitive;
     *      var primIndex = hit.primIndex;
     *      var bary = hit.bary;
     * }
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
     * Picks the closest object behind the given canvas coordinates.
     *
     * This is equivalent to firing a ray through the canvas, down the negative Z-axis, to find the first entity it hits.
     *
     * @param {[Number, Number]} canvasPos Canvas position.
     * @returns {{id: String}} If object found, a hit record containing the ID of the object, else null.
     * @example
     * var hit = viewer.pickObject([234, 567]);
     * if (hit) {
     *      var objectId = hit.id;
     * }
     */
    this.pickObject = function (canvasPos) {
        var hit = scene.pick({canvasPos: canvasPos, pickSurface: false});
        if (hit) {
            return {id: hit.entity.id};
        }
    };

    /**
     * Picks the closest object behind the given canvas coordinates, along with geometric information about
     * the point on the object's surface that lies right behind those canvas coordinates.
     *
     * @param {[Number, Number]} canvasPos Canvas position.
     * @returns {{id: String, worldPos: [number,number,number], primIndex:number, bary: [number,number,number]}} If object
     * found, a hit record containing the ID of object, World-space 3D surface intersection, primitive index and
     * barycentric coordinates, else null.
     * @example
     * var hit = viewer.pickSurface([234, 567]);
     * if (hit) {
     *      var objectId = hit.id;
     *      var primitive = hit.primitive;
     *      var primIndex = hit.primIndex;
     *      var bary = hit.bary;
     * }
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

    /**
     * Creates an annotation.
     *
     * An annotation is a labeled pin that's attached to the surface of an object.
     *
     * An annotation is pinned within a triangle of an object's geometry, at a position given in barycentric
     * coordinates. A barycentric coordinate is a three-element vector that indicates the position within
     * the triangle as a weight per vertex, where a value of ````[0.3,0.3,0.3]```` places the annotation
     * at the center of its triangle.
     *
     * An annotation can be configured with an optional camera position from which to view it, given as ````eye````,
     * ````look```` and ````up```` vectors.
     *
     * By default, an annotation will be invisible while occluded by other objects in the 3D view.
     *
     * Note that when you pick an object with {@link #.Viewer#rayCastSurface} or {@link #.Viewer#pickSurface}, you'll get
     * a triangle index and barycentric coordinates in the intersection result. This makes it convenient to
     * create annotations directly from pick results.
     *
     * @param {String} id ID for the new annotation.
     * @param {Object} cfg Properties for the new annotation.
     * @param {String} cfg.object ID of an object to pin the annotation to.
     * @param {String} [cfg.glyph=""] A glyph for the new annotation. This appears in the annotation's pin and
     * is typically a short string of 1-2 chars, eg. "a1".
     * @param {String} [cfg.title=""] Title text for the new annotation.
     * @param {String} [cfg.desc=""] Description text for the new annotation.
     * @param {Number} cfg.primIndex Index of a triangle, within the object's geometry indices, to attach the annotation to.
     * @param {[Number, Number, Number]} cfg.bary Barycentric coordinates within the triangle, at which to position the annotation.
     * @param {[Number, Number, Number]} [cfg.eye] Eye position for optional camera viewpoint.
     * @param {[Number, Number, Number]} [cfg.look] Look position for optional camera viewpoint.
     * @param {[Number, Number, Number]} [cfg.up] Up direction for optional camera viewpoint.
     * @param {Boolean} [cfg.occludable=true] Whether or not the annotation dissappears while occluded by something else in the 3D view.
     * @param {Boolean} [cfg.pinShown=true] Whether or not the annotation's pin is initially shown.
     * @param {Boolean} [cfg.labelShown=true] Whether or not the annotation's label is initially shown.
     * @returns {Viewer} this
     */
    this.createAnnotation = function (id, cfg) {
        if (scene.components[id]) {
            error("Component with this ID already exists: " + id);
            return this;
        }
        if (cfg === undefined) {
            error("Annotation configuration expected");
            return this;
        }
        var objectId = cfg.object;
        if (objectId === undefined) {
            error("Annotation property expected: objectId");
            return this;
        }
        var object = objects[objectId];
        if (!object) {
            error("Object not found: " + objectId);
            return this;
        }
        var primIndex = cfg.primIndex;
        if (primIndex === undefined) {
            error("Annotation property expected: primIndex");
            return this;
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
        return this;
    };

    /**
     * Gets the IDs of the annotations within a model, object or a type.
     *
     * When no argument is given, returns the IDs of all annotations.
     *
     * @param {String|String[]} id ID of a model, object or IFC type.
     * @return {String[]} IDs of the annotations.
     */
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

    /**
     * Destroys an annotation.
     *
     * @param {String} id ID of the annotation.
     * @return {Viewer} This viewer
     */
    this.destroyAnnotation = function (id) {
        var annotation = annotations[id];
        if (!annotation) {
            return this;
        }
        if (annotation.entity) {
            delete objectAnnotations[annotation.entity.id][annotation.id];
        }
        annotation.destroy();
        delete annotations[id];
        return this;

    };

    /**
     * Destroys all annotations.
     *
     * @return {Viewer} This viewer
     */
    this.clearAnnotations = function () {
        for (var ids = Object.keys(annotations), i = 0; i < ids.length; i++) {
            this.destroyAnnotation(ids[i]);
        }
        return this;
    };

    /**
     * Sets the triangle that an annotation is pinned to.
     *
     * The triangle is indicated by the position of the first of the triangle's vertex indices within
     * the object's geometry indices array.
     *
     * @param {String} id ID of the annotation.
     * @param {Number} primIndex The index of the triangle's first element within the geometry's
     * indices array.
     * @returns {Viewer} This viewer
     */
    this.setAnnotationPrimIndex = function (id, primIndex) {
        var annotation = annotations[id];
        if (!annotation) {
            error("Annotation not found: \"" + id + "\"");
            return this;
        }
        annotation.primIndex = primIndex;
        return this;
    };

    /**
     * Gets the triangle that an annotation is pinned to.
     *
     * The triangle is indicated by the position of the first of the triangle's vertex indices within
     * the object's geometry indices array.
     *
     * @param {String} id ID of the annotation.
     * @returns {Number} The index of the triangle's first element within the geometry's indices array.
     */
    this.getAnnotationPrimIndex = function (id) {
        var annotation = annotations[id];
        if (!annotation) {
            error("Annotation not found: \"" + id + "\"");
            return;
        }
        return annotation.primIndex;
    };

    /**
     * Sets the text within an annotation's pin.
     *
     * In order to fit within the pin, this should be a short string of 1-2 characters.
     *
     * @param {String} id ID of the annotation.
     * @param {String} glyph Pin text.
     * @returns {Viewer} This
     */
    this.setAnnotationGlyph = function (id, glyph) {
        var annotation = annotations[id];
        if (!annotation) {
            error("Annotation not found: \"" + id + "\"");
            return this;
        }
        annotation.glyph = glyph;
        return this;
    };

    /**
     * Gets the text within an annotation's pin.
     *
     * @param {String} id ID of the annotation.
     * @returns {String} Pin text.
     */
    this.getAnnotationGlyph = function (id) {
        var annotation = annotations[id];
        if (!annotation) {
            error("Annotation not found: \"" + id + "\"");
            return;
        }
        return annotation.glyph;
    };

    /**
     * Sets the title text within an annotation's label.
     *
     * @param {String} id ID of the annotation.
     * @param {String} title Title text.
     * @returns {Viewer} This
     */
    this.setAnnotationTitle = function (id, title) {
        var annotation = annotations[id];
        if (!annotation) {
            error("Annotation not found: \"" + id + "\"");
            return this;
        }
        annotation.title = title;
        return this;
    };

    /**
     * Gets the title text within an annotation's label.
     *
     * @param {String} id ID of the annotation.
     * @returns {String} Title text.
     */
    this.getAnnotationTitle = function (id) {
        var annotation = annotations[id];
        if (!annotation) {
            error("Annotation not found: \"" + id + "\"");
            return;
        }
        return annotation.title;
    };

    /**
     * Sets the description text within an annotation's label.
     *
     * @param {String} id ID of the annotation.
     * @param {String} title Description text.
     * @returns {Viewer} This
     */
    this.setAnnotationDesc = function (id, desc) {
        var annotation = annotations[id];
        if (!annotation) {
            error("Annotation not found: \"" + id + "\"");
            return this;
        }
        annotation.desc = desc;
        return this;
    };

    /**
     * Gets the description text within an annotation's label.
     *
     * @param {String} id ID of the annotation.
     * @returns {String} Title text.
     */
    this.getAnnotationDesc = function (id) {
        var annotation = annotations[id];
        if (!annotation) {
            error("Annotation not found: \"" + id + "\"");
            return;
        }
        return annotation.desc;
    };

    /**
     * Sets the barycentric coordinates of an annotation within its triangle.
     *
     * A barycentric coordinate is a three-element vector that indicates the position within the triangle as a weight per vertex,
     * where a value of ````[0.3,0.3,0.3]```` places the annotation at the center of its triangle.
     *
     * @param {String} id ID of the annotation.
     * @param {[Number, Number, Number]} bary The barycentric coordinates.
     * @returns {Viewer} This
     */
    this.setAnnotationBary = function (id, bary) {
        var annotation = annotations[id];
        if (!annotation) {
            error("Annotation not found: \"" + id + "\"");
            return this;
        }
        annotation.bary = bary;
        return this;
    };

    /**
     * Gets the barycentric coordinates of an annotation within its triangle.
     *
     * @param {String} id ID of the annotation.
     * @returns {[Number, Number, Number]} The barycentric coordinates.
     */
    this.getAnnotationBary = function (id) {
        var annotation = annotations[id];
        if (!annotation) {
            error("Annotation not found: \"" + id + "\"");
            return;
        }
        return annotation.bary;
    };

    /**
     * Sets the object that an annotation is pinned to.
     *
     * An annotation must always be pinned to an object.
     *
     * @param {String} id ID of the annotation.
     * @param {String} objectId ID of the object.
     * @returns {Viewer} This
     */
    this.setAnnotationObject = function (id, objectId) {
        var annotation = annotations[id];
        if (!annotation) {
            error("Annotation not found: \"" + id + "\"");
            return this;
        }
        var object = objects[objectId];
        if (!object) {
            error("Object not found: \"" + objectId + "\"");
            return this;
        }
        annotation.entity = object;
        return this;
    };

    /**
     * Gets the object that an annotation is pinned to.
     *
     * @param {String} id ID of the annotation.
     * @returns {String} ID of the object.
     */
    this.getAnnotationObject = function (id) {
        var annotation = annotations[id];
        if (!annotation) {
            error("Annotation not found: \"" + id + "\"");
            return;
        }
        var entity = annotation.entity;
        return entity ? entity.id : null;
    };

    /**
     * Sets the camera ````eye```` position from which to view an annotation.
     *
     * @param {String} id ID of the annotation.
     * @param {[Number, Number, Number]} eye Eye position for camera viewpoint.
     * @returns {Viewer} This viewer.
     */
    this.setAnnotationEye = function (id, eye) {
        var annotation = annotations[id];
        if (!annotation) {
            error("Annotation not found: \"" + id + "\"");
            return this;
        }
        annotation.eye = eye;
        return this;
    };

    /**
     * Gets the camera ````eye```` position from which to view an annotation.
     *
     * @param {String} id ID of the annotation.
     * @param {[Number, Number, Number]} eye Eye position for camera viewpoint.
     */
    this.getAnnotationEye = function (id) {
        var annotation = annotations[id];
        if (!annotation) {
            error("Annotation not found: \"" + id + "\"");
            return;
        }
        return annotation.eye;
    };

    /**
     * Sets the camera ````look```` position from which to view an annotation.
     *
     * @param {String} id ID of the annotation.
     * @param {[Number, Number, Number]} look Look position for camera viewpoint.
     * @returns {Viewer} This viewer.
     */
    this.setAnnotationLook = function (id, look) {
        var annotation = annotations[id];
        if (!annotation) {
            error("Annotation not found: \"" + id + "\"");
            return this;
        }
        annotation.look = look;
        return this;
    };

    /**
     * Gets the camera ````look```` position from which to view an annotation.
     *
     * @param {String} id ID of the annotation.
     * @returns {[Number, Number, Number]} Look position for camera viewpoint.
     */
    this.getAnnotationLook = function (id) {
        var annotation = annotations[id];
        if (!annotation) {
            error("Annotation not found: \"" + id + "\"");
            return;
        }
        return annotation.look;
    };

    /**
     * Sets the camera ````up```` vector from which to view an annotation.
     *
     * @param {String} id ID of the annotation.
     * @param {[Number, Number, Number]} up Up vector for camera viewpoint.
     * @returns {Viewer} This viewer.
     */
    this.setAnnotationUp = function (id, up) {
        var annotation = annotations[id];
        if (!annotation) {
            error("Annotation not found: \"" + id + "\"");
            return this;
        }
        annotation.up = up;
        return this;
    };

    /**
     * Gets the camera ````up```` direction from which to view an annotation.
     *
     * @param {String} id ID of the annotation.
     * @returns {[Number, Number, Number]} Up vector for camera viewpoint.
     */
    this.getAnnotationUp = function (id) {
        var annotation = annotations[id];
        if (!annotation) {
            error("Annotation not found: \"" + id + "\"");
            return;
        }
        return annotation.up;
    };

    /**
     * Sets whether or not an annotation dissappears when occluded by another object.
     *
     * @param {String} id ID of the annotation.
     * @param {Boolean} occludable Whether the annotation dissappears when occluded.
     * @returns {Viewer} This viewer.
     */
    this.setAnnotationOccludable = function (id, occludable) {
        var annotation = annotations[id];
        if (!annotation) {
            error("Annotation not found: \"" + id + "\"");
            return this;
        }
        annotation.occludable = occludable;
        return this;
    };

    /**
     * Gets whether or not an annotation dissappears when occluded by another object.
     *
     * @param {String} id ID of the annotation.
     * @returns {Boolean} Whether the annotation dissappears when occluded.
     */
    this.getAnnotationOccludable = function (id) {
        var annotation = annotations[id];
        if (!annotation) {
            error("Annotation not found: \"" + id + "\"");
            return;
        }
        return annotation.occludable;
    };

    /**
     * Sets whether an annotation's pin is shown.
     *
     * @param {String} id ID of the annotation.
     * @param {Boolean} pinShown Whether the annotation's pin is shown.
     * @returns {Viewer} This viewer.
     */
    this.setAnnotationPinShown = function (id, pinShown) {
        var annotation = annotations[id];
        if (!annotation) {
            error("Annotation not found: \"" + id + "\"");
            return this;
        }
        annotation.pinShown = pinShown;
        return this;
    };

    /**
     * Gets whether an annotation's pin is shown.
     *
     * @param {String} id ID of the annotation.
     * @returns {Boolean} Whether the annotation's pin is shown.
     */
    this.getAnnotationPinShown = function (id) {
        var annotation = annotations[id];
        if (!annotation) {
            error("Annotation not found: \"" + id + "\"");
            return;
        }
        return annotation.pinShown;
    };

    /**
     * Sets whether an annotation's label is shown.
     *
     * @param {String} id ID of the annotation.
     * @param {Boolean} labelShown Whether the annotation's label is shown.
     * @returns {Viewer} This viewer.
     */
    this.setAnnotationLabelShown = function (id, labelShown) {
        var annotation = annotations[id];
        if (!annotation) {
            error("Annotation not found: \"" + id + "\"");
            return this;
        }
        annotation.labelShown = labelShown;
        return this;
    };

    /**
     * Gets whether an annotation's label is shown.
     *
     * @param {String} id ID of the annotation.
     * @returns {Boolean} Whether the annotation's label is shown.
     */
    this.getAnnotationLabelShown = function (id) {
        var annotation = annotations[id];
        if (!annotation) {
            error("Annotation not found: \"" + id + "\"");
            return;
        }
        return annotation.labelShown;
    };

    //----------------------------------------------------------------------------------------------------
    // User clipping planes
    //----------------------------------------------------------------------------------------------------

    /**
     * Creates a user-defined clipping plane.
     *
     * The plane is positioned at a given World-space position, oriented in a given direction. The plane
     * may be configured to clip elements that fall either in front or behind it, and may be activated
     * or deactivated.
     *
     * @param {String} id Unique ID to assign to the clipping plane.
     * @param {Object} cfg Clip plane configuration.
     * @param {[Number, Number, Number]} [cfg.pos=0,0,0] World-space position of the clip plane.
     * @param {[Number, Number, Number]} [cfg.dir=[0,0,-1]} Vector indicating the orientation of the clip plane.
     * @param {Boolean} [cfg.active=true] Whether the clip plane is initially active. Only clips while this is true.
     * @param {Boolean} [cfg.shown=true] Whether to show a helper object to indicate the clip plane's position and orientation.
     * @param {Number} [cfg.side=1] Which side of the plane to discard elements from. A value of ````1```` discards from
     * the front of the plane (with respect to the plane orientation vector), while ````-1```` discards elements behind the plane.
     * @returns {Viewer} this
     */
    this.createClip = function (id, cfg) {
        if (scene.components[id]) {
            error("Component with this ID already exists: " + id);
            return this;
        }
        if (cfg === undefined) {
            error("Clip configuration expected");
            return this;
        }
        var clip = new xeogl.Clip(scene, {
            id: id,
            pos: cfg.pos,
            dir: cfg.dir,
            active: cfg.active
        });
        clips[clip.id] = clip;
        clipHelpers[clip.id] = new xeogl.ClipHelper(scene, {
            clip: clip
        });
        clipsDirty = true;
        if (cfg.shown) {
            this.showClip(id);
        } else {
            this.hideClip(id);
        }
        return this;
    };

    /**
     * Gets the IDs of the clip planes currently in the viewer.
     * @return {String[]} IDs of the clip planes.
     */
    this.getClips = function () {
        return Object.keys(clips);
    };

    /**
     * Removes a clip plane from this viewer.
     * @param {String} id ID of the clip plane to remove.
     * @returns {Viewer} this
     */
    this.destroyClip = function (id) {
        var clip = clips[id];
        if (!clip) {
            return this;
        }
        this.hideClip(id);
        clip.destroy();
        delete clips[id];
        clipHelpers[id].destroy();
        delete clipHelpers[id];
        clipsDirty = true;
        return this;
    };

    /**
     * Removes all clip planes from this viewer.
     * @returns {Viewer} this
     */
    this.clearClips = function () {
        for (var ids = Object.keys(clips), i = 0; i < ids.length; i++) {
            this.destroyClip(ids[i]);
        }
        return this;
    };

    /**
     * Shows a helper object to indicate the position and orientation of a clipping plane.
     * @param {String} id ID of the clip plane to show.
     * @returns {Viewer}
     */
    this.showClip = function (id) {
        var clipHelper = clipHelpers[id];
        if (!clipHelper) {
            error("Clip not found: \"" + id + "\"");
            return this;
        }
        clipHelper.visible = true;
        return this;
    };

    /**
     * Hides the helper object that indicates the position and orientation of the given clipping plane.
     * @param {String} id ID of the clip plane to hide.
     * @returns {Viewer}
     */
    this.hideClip = function (id) {
        var clipHelper = clipHelpers[id];
        if (!clipHelper) {
            error("Clip not found: \"" + id + "\"");
            return this;
        }
        clipHelper.visible = false;
        return this;
    };

    /**
     * Enables a clipping plane.
     * @param {String} id ID of the clip plane to enable.
     * @returns {Viewer}
     */
    this.enableClip = function (id) {
        var clip = clips[id];
        if (!clip) {
            error("Clip not found: \"" + id + "\"");
            return this;
        }
        clip.active = true;
        return this;
    };

    /**
     * Disables a clipping plane.
     * @param {String} id ID of the clip plane to disable.
     * @returns {Viewer}
     */
    this.disableClip = function (id) {
        var clip = clips[id];
        if (!clip) {
            error("Clip not found: \"" + id + "\"");
            return this;
        }
        clip.active = false;
        return this;
    };

    /**
     * Sets the position of the given clip plane.
     * @param {String} id ID of the clip plane to remove.
     * @param {[Number, Number, Number]} [pos=0,0,0] World-space position of the clip plane.
     * @returns {Viewer}
     */
    this.setClipPos = function (id, pos) {
        var clip = clips[id];
        if (!clip) {
            error("Clip not found: \"" + id + "\"");
            return this;
        }
        clip.pos = pos;
        return this;
    };

    /**
     * Gets the position of the given clip plane.
     * @param {String} id ID of the clip plane.
     * @returns {[Number, Number, Number]} World-space position of the plane.
     */
    this.getClipPos = function (id) {
        var clip = getclip(id);
        if (!clip) {
            error("Clip not found: \"" + id + "\"");
            return;
        }
        return clip.pos;
    };

    /**
     * Sets the orientation of the given clip plane.
     * @param {String} id ID of the clip plane.
     * @param {[Number, Number, Number]} [dir=0,0,1] Orientation vector.
     * @returns {Viewer} this
     */
    this.setClipDir = function (id, dir) {
        var clip = clips[id];
        if (!clip) {
            error("Clip not found: \"" + id + "\"");
            return this;
        }
        clip.dir = dir;
        return this;
    };

    /**
     * Gets the orientation of the given clip plane.
     * @param {String} id ID of the clip plane.
     * @returns {[Number, Number, Number]} Orientation vector.
     */
    this.getClipDir = function (id) {
        var clip = clips[id];
        if (!clip) {
            error("Clip not found: \"" + id + "\"");
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
     * The viewer can then be restored to the bookmark at any time using {@link #setBookmark}.
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

        function getSrc(id) {
            var src = modelSrcs[id];
            return xeogl._isString(src) ? src : xeogl._copy(src);
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
                        src: getSrc(id)
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
                    if (object.visible) {
                        objectState = objectState || (bookmark.objects[id] = {});
                        objectState.visible = true;
                    } else if (objectState) {
                        objectState.visible = false;
                    }
                    if (object.material.alphaMode === "blend") {
                        objectState = objectState || (bookmark.objects[id] = {});
                        objectState.opacity = object.material.alpha;
                    }
                    if (object.clippable) {
                        objectState = objectState || (bookmark.objects[id] = {});
                        objectState.clippable = true;
                    } else if (objectState) {
                        objectState.clippable = false;
                    }
                }
            }

            bookmark.annotations = {};
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

            bookmark.clips = {};
            for (id in clips) {
                var clip;
                var clipsState;
                if (clips.hasOwnProperty(id)) {
                    clip = clips[id];
                    clipsState = {
                        pos: vecToArray(clip.pos),
                        dir: vecToArray(clip.dir),
                        active: clip.active,
                        side: clip.side
                    };
                    bookmark.clips[id] = clipsState;
                }
            }

            bookmark.lookat = {
                eye: vecToArray(view.eye),
                look: vecToArray(view.look),
                up: vecToArray(view.up)
            };

            bookmark.projection = projectionType;

            bookmark.perspectiveNear = projections.perspective.near;
            bookmark.perspectiveFar = projections.perspective.far;
            bookmark.perspectiveFOV = projections.perspective.fovy;

            bookmark.orthoNear = projections.orthographic.near;
            bookmark.orthoFar = projections.orthographic.far;
            bookmark.orthoScale = projections.orthographic.scale;

            return bookmark;
        };
    })();

    /**
     * Sets viewer state to the snapshot contained in given JSON bookmark.
     *
     * A bookmark is a complete snapshot of the viewer's state, which was
     * captured earlier with {@link #getBookmark}.
     *
     * @param {Object} bookmark JSON bookmark.
     * @returns {Viewer} this
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
                this.clear();
                return;
            }
            self.clearClips();
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
                        if (objectState.clippable !== undefined) {
                            self.setClippable(id, objectState.clippable);
                        }
                    }
                }
                var clipStates = bookmark.clips;
                for (id in clipStates) {
                    if (clipStates.hasOwnProperty(id)) {
                        self.createClip(id, clipStates[id]);
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
                self.setProjection(bookmark.projection);
                self.setPerspectiveNear(bookmark.perspectiveNear);
                self.setPerspectiveFar(bookmark.perspectiveFar);
                self.setPerspectiveFOV(bookmark.perspectiveFOV);
                self.setOrthoNear(bookmark.orthoNear);
                self.setOrthoFar(bookmark.orthoFar);
                self.setOrthoScale(bookmark.orthoScale);
            });
        };
    })();

    /**
     * Captures a snapshot image of the viewer's canvas.
     *
     * When a callback is given, this method will capture the snapshot asynchronously, on the next animation frame,
     * and return it via the callback.
     *
     * When no callback is given, this method captures and returns the snapshot immediately. Note that is only
     * possible when you have configured the viewer to preserve the WebGL drawing buffer (which incurs a
     * performance overhead).
     *
     * @param {*} [params] Capture options.
     * @param {Number} [params.width] Desired width of result in pixels - defaults to width of canvas.
     * @param {Number} [params.height] Desired height of result in pixels - defaults to height of canvas.
     * @param {String} [params.format="jpeg"] Desired format; "jpeg", "png" or "bmp".
     * @param {Function} [ok] Callback to return the image data when taking a snapshot asynchronously.
     * @returns {String} String-encoded image data when taking the snapshot synchronously. Returns null when the ````ok```` callback is given.
     * @example
     * // Get snapshot asynchronously
     * viewer.getSnapshot({
     *     width: 500,
     *     height: 500,
     *     format: "png"
     * }, function(imageDataURL) {
     *     imageElement.src = imageDataURL;
     * });
     *
     * // Get snapshot synchronously, requires that viewer be
     * // configured with preserveDrawingBuffer; true
     * imageElement.src = viewer.getSnapshot({
     *     width: 500,
     *     height: 500,
     *     format: "png"
     * });
     */
    this.getSnapshot = function (params, ok) {
        params = params || {};
        var src = scene.canvas.getSnapshot({
            width: params.width, // Defaults to size of canvas
            height: params.height,
            format: params.format || "png" // Options are "jpeg" (default), "png" and "bmp"
        }, ok);
        return ok ? null : src;
    };

    /**
     * Clears and destroys this viewer.
     * @returns {Viewer} this
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
        clips = {};
        clipHelpers = {};
        return this;
    };

    function error(msg) {
        console.error("[xeometry] " + msg);
    }

    this.setBookmark(cfg);
};