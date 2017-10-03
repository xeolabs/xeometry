# xeometry

xeometry is a JavaScript API for viewing glTF models on WebGL.

* [Examples](http://xeolabs.com/examples)
* [API Docs](http://xeolabs.com/xeometry)

# Contents

- [Introduction](#introduction)
- [Motivation](#motivation)
- [Usage](#usage)
  * [Creating a viewer](#creating-a-viewer)
  * [Loading models](#loading-models)
  * [Querying scene content](#querying-scene-content)
    + [Getting models and objects](#getting-models-and-objects)
    + [Getting boundaries](#getting-boundaries)
    + [Getting object geometries](#getting-object-geometries)
  * [Assigning types to objects](#assigning-types-to-objects)
  * [Camera control](#camera-control)
    + [Fitting things in view](#fitting-things-in-view)
    + [Panning](#panning)
    + [Rotating](#rotating)
    + [Zooming](#zooming)
    + [Projections](#projections)
  * [Transforming models and objects](#transforming-models-and-objects)
  * [Showing and hiding models and objects](#showing-and-hiding-models-and-objects)
  * [Picking objects](#picking-objects)
  * [Outlining objects](#outlining-objects)
  * [Clipping](#clipping)
  * [Annotations](#annotations)
  * [Canvas snapshots](#canvas-snapshots)
  * [Viewer bookmarks](#viewer-bookmarks)
  * [Building](#building)

# Introduction

A xeometry [Viewer](http://xeolabs.com/xeometry/docs/#viewer) is a single class that wraps [xeogl](http://xeogl.org) in a
set of simple data-driven methods focused on loading glTF models and manipulating scene content to create cool presentations.

The example below shows the idea. In this example, we're loading a glTF model of a reciprocating saw, setting some objects
transparent to reveal the inner workings, then positioning the camera to fit everything in view.

[![](http://xeolabs.com/xeometry/assets/sawObjects.png)](http://xeogl.org/examples/#presentation_annotations_tronTank)

```` JavaScript
var viewer = new xeometry.Viewer({ canvasId: "theCanvas" });

viewer.loadModel("saw", "models/Reciprocating_Saw.gltf", function () {
     viewer.setOpacity(["saw#0", "saw#1", "saw#2", "saw#3", "saw#11"], 0.3);
     viewer.viewFit("saw");
});
````

Viewer methods generally get or set some property of a target element in the scene, such as the opacity of an object, or
the position of the camera.

Some of the things you can do with objects are:

* showing and hiding,
* rotating, scaling and translating,
* changing opacity,
* annotating,
* outlining,
* slicing with clipping planes,
* getting boundaries,
* fitting to view,
* picking and raycasting.

xeometry tracks all your updates, and is able to serialize a viewer's state as a JSON bookmark:

```` JavaScript
var bookmark = viewer.getBookmark();
````
A bookmark contains a complete snapshot of the viewer's state, including what models are loaded, object properties,
camera position etc - everything you've done through the viewer API. We can restore a viewer to a bookmark at any time:
```` JavaScript
viewer.setBookmark(bookmark);
````
We can also initialize another viewer from a bookmark:
```` JavaScript
var viewer2 = new xeometry.Viewer({ canvasId: "anotherCanvas" });
````

# Motivation

# Usage

## Creating a viewer

The first step is to link to the xeometry library:
````html
<script src="xeometry.js"></script>
````

Create a viewer with a default internally-created canvas that fills the page:
````javascript
var viewer = new xeometry.Viewer();
````

Create a viewer with an existing canvas:
````javascript
var viewer = new xeometry.Viewer({
    canvasId: "myCanvas"
});
````

You can create multiple viewers in the same page.

Destroy a viewer:
````javascript
viewer.destroy();
````

## Loading models

You can load multiple glTF models into a viewer at the same time, as well as multiple copies of the same model.

Loading two separate models into a viewer:
````javascript
viewer.loadModel("saw", "./Reciprocating_Saw.gltf", function () { /* Loaded */ });

viewer.loadModel("gearbox", "./GearboxAssy.gltf", function () { /* Loaded */ });
````

Loading two copies of the same model into a viewer:
````javascript
viewer.loadModel("saw1", "./Reciprocating_Saw.gltf", function () { /* Loaded */ });

viewer.loadModel("saw2", "./Reciprocating_Saw.gltf", function () { /* Loaded */ });
````

Unloading a model:
````javascript
viewer.unloadModel("gearbox");
````

Clearing everything from the viewer:
````javascript
viewer.clear();
````

## Querying scene content

### Getting models and objects

You can query the models and objects that are currently loaded in your viewer.

Get all models:
````javascript
var models = viewer.getModels();
````

Get all objects:
````javascript
var objects = viewer.getObjects();
````

Get all objects in a model:
````javascript
var saw = viewer.getObjects("saw");
````

Get an object's model:
````javascript
var model = viewer.getModel("saw#23");
````

### Getting boundaries

You can dynamically query the boundaries of models and objects in your viewer. A boundary is an axis-aligned
World-space box, given as an array of values ````[xmin, ymin, zmin, xmax, ymax, zmax]````.

Get the collective boundary of everything in a viewer:
````javascript
var totalBoundary = viewer.getAABB();
````

Get the boundary of a model:
````javascript
var sawBoundary = viewer.getAABB("saw");
````

Get collective boundary of two objects:
````javascript
var objectsBoundary = viewer.getAABB(["saw34", "saw5"]);
````

Get collective boundary of all objects of the given types:
````javascript
var objectsBoundary = viewer.getAABB(["IfcFlowController", "IfcFlowFitting"]);
````

Get collective boundary of two models:
````javascript
var modelsBoundary = viewer.getAABB(["saw", "gearbox"]);
````

Get collective boundary of the first five objects within a given model:
````javascript
var objectsBoundary2 = viewer.getAABB(viewer.objects("saw").slice(0, 5));
````

Get collective boundary of a model and a couple of objects:
````javascript
var objectsBoundary3 = viewer.getAABB(["saw", "saw#2", "saw#5"]);
````

### Getting object geometries

You can query the geometry of each of the objects in your viewer. This is useful when
you want to implement application logic for things like collision detection etc.

Geometry consists of World-space vertex positions, a primitive type, and indices, which link
the positions together according to the primitive type.

Transforming an object will update its vertex positions.

Get the World-space vertex positions of an object:
````javascript
var positions = viewer.getPositions("saw#43");
````

Get the indices of an object:
````javascript
var indices = viewer.getIndices("saw#43");
````

Get an object's primitive type:
````javascript
var primitive = viewer.getPrimitive("saw#43");
````

Possible values for the primitive are 'points', 'lines',
'line-loop', 'line-strip', 'triangles', 'triangle-strip' and 'triangle-fan'.

## Assigning types to objects

Each object in your viewer may optionally be assigned a type. Types are strings that mean something within
the domain of your application. When using xeometry as an IFC viewer, for example, then types would likely
 be IFC element types.

When you have assigned types to your objects, then you can specify types as the targets for various xeometry methods.

Assign types to two objects:
````javascript
viewer.setType("house#12", "IfcFlowController");
viewer.setType("house#23", "IfcFlowFitting");
````

Get the type of an object:
````javascript
var type = viewer.getType("house#12");
````

Get all types in the viewer:
````javascript
var types = viewer.getTypes();
````

Get all objects of the given type:
````javascript
var typeObjects = viewer.getObjects("ifcCurtainWall");
````

## Camera control

A viewer has a single camera that can be moved in "orbit" or first-person mode, directed to fit target
elements in view, and switched between perspective and orthographic projections.

Getting camera ````eye````, ````look```` and ````up````:
````javascript
var eye = viewer.getEye();
var look = viewer.getLook();
var up = viewer.getUp();
````

Setting camera ````eye````, ````look```` and ````up````:
````javascript
viewer.setEye([0,0,-100]);
viewer.setLook([0,0,0]);
viewer.setUp([0,1,0]);
````

### Fitting things in view

The camera can also be made to fit given models, objects, types or boundaries in view, either by flying or jumping to
a new position.

Make camera fly for two seconds as it moves to each new target:
````javascript
viewer.setViewFitDuration(2); // Seconds
````

When the duration greater than zero, the camera will fly, otherwise it will snap straight to each new target.

Fly camera to given position:
````javascript
// Eye, look and "up" vector
viewer.setEyeLookUp([0,0,-100],[0,0,0],[0,1,0], function() {
    // Camera arrived
});
````

Fly camera to fit everything in view:
````javascript
viewer.viewFit(function() {
    // Camera arrived
});
````

Fly camera to fit a model in view:
````javascript
viewer.viewFit("saw", function() {
    // Camera arrived
});
````

Fly camera to fit two models in view:
````javascript
viewer.viewFit(["saw", "gearbox"], function() {
    // Camera arrived
});
````

Fly camera to fit all objects of the given types:
````javascript
viewer.viewFit(["IfcFlowController", "IfcFlowFitting"], function() {
    // Camera arrived
});
````

Fly camera to fit a model, two objects, and all objects of the given type:
````javascript
viewer.viewFit(["gearbox", "saw#1", "saw#5", "IfcFlowFitting"], function() {
    // Camera arrived
});
````

Fly camera to fit all objects of the given types, looking along the World-space -X axis:
````javascript
viewer.viewFitLeft(["IfcFlowController", "IfcFlowFitting"], function() {
    // Camera arrived
});
````

Fly camera to fit a model, two objects, and all objects of the given type, looking along the World-space -Y axis:
````javascript
viewer.viewFitTop(["gearbox", "saw#1", "saw#5", "IfcFlowFitting"], function() {
    // Camera arrived
});
````

Set camera to jump directly to each new position:
````javascript
viewer.setViewFitDuration(0);
````

Jump camera to given position:
````javascript
viewer.setEyeLookUp([-100,0,0],[0,0,0],[0,1,0]);
````

Jump camera to fit two objects in view - note we don't need the callback anymore because camera is now jumping:
````javascript
viewer.viewFit(["saw34", "saw5"]);
````

Jump camera to fit a model and two objects in view:
````javascript
viewer.viewFit(["gearbox", "saw#2", "saw#5"]);
````

Set how much of the field of view that a target boundary will occupy when flying the camera to fit models or objects to the view:
````javascript
viewer.setViewFitFOV(20); // Degrees
var fitFOV = viewer.fitFOV();
````

### Panning

You can pan the camera incrementally along its local axis.

Panning translates the camera's ````eye```` and ````look```` positions in unison.

* Horizontal panning moves the camera along the axis perpendicular to ````eye->look```` and ````up````.
* Vertical panning moves the camera along ````up````.
* Forward and back panning moves the camera along the ````eye->look```` vector.

Pan camera ````eye```` and ````look```` five units along the axis orthogonal to ````eye->look```` and ````up````:
````javascript
viewer.panCamera([-5, 0, 0]);
````

Pan camera backwards 10 units along the ````eye->look```` vector:
````javascript
viewer.panCamera([0, 0, -10]);
````

### Rotating

You can rotate the camera incrementally, either rotating ````eye```` about ````look```` (orbiting),
or rotating ````look```` about ````eye```` (first-person rotation).

Vertical rotation is gimbal-locked to the World-space Y-axis by default. You can disable that
 to make the camera pivot about its ````up```` vector, for more of a trackball type rotation:
````javascript
viewer.lockGimbalY(false);
````

Rotate the camera's ````eye```` about ````look````, pivoting around ````up````:
````javascript
viewer.rotateEyeY(10);
````

Rotate the camera's ````eye```` about ````look````, pivoting around the axis orthogonal to ````eye->look```` and ````up````:
````javascript
viewer.rotateEyeX(10);
````

Rotate the camera's ````look```` about ````eye````, pivoting around the World-space Y-axis if
gimbal locking is enabled, otherwise pivoting around ````up````:
````javascript
viewer.rotateLookY(10);
````

Rotate the camera's ````look```` about ````eye````, pivoting around the World-space Y-axis if
gimbal locking is enabled, otherwise pivoting around the axis orthogonal to ````eye->look```` and ````up````:
````javascript
viewer.rotateLookX(10);
````

### Zooming

You can zoom the camera incrementally, which varies the distance of ````eye```` from ````look````:
````javascript
viewer.zoom(12.3);
````

### Projections

You can switch the camera between perspective and orthographic projection at any time.

Switch camera to orthographic projection:
````javascript
viewer.setProjection("ortho");
````
Set orthographic projection properties:
````javascript
viewer.setOrthoScale(2.0); // How many units to fit within view volume
viewer.setOrthoNear(0.1);
viewer.setOrthoFar(8000);
````

Switch camera to perspective projection:

````javascript
viewer.setProjection("perspective");
````

Set perspective projection properties:
````javascript
viewer.setPerspectiveFOV(45); // Field of view in degrees
viewer.setPerspectiveNear(0.1);
viewer.setPerspectiveFar(10000);
````

Note that you can get and set properties for each projection at any time, regardless of which one is active.


## Transforming models and objects

You can independently transform each model and object in your viewer.

[![](http://xeolabs.com/xeometry/assets/sawObjects.png)](http://xeogl.org/examples/#presentation_annotations_tronTank)

A transform consists of the following operations, applied in this order:

 1. scale
 2. X-axis rotation (degrees),
 3. Y-axis rotation,
 4. Z-axis rotation
 5. translation

An object's transform is relative to its model's transform.

Transforming an object will dynamically update its boundary and geometry vertex positions.

Transforming a model will dynamically update its boundary, along with the boundary and geometry vertex positions of each
of its objects.

Translate a model along the X axis, scale it, then rotate it 90 degrees about its X-axis:
````javascript
viewer.setTranslate("saw", [100,0,0]);
viewer.setScale("saw", [0.5,0.5,0.5]);
viewer.setRotate("saw", [90,0,0]);
`````

Spin an object about its Y-axis:
````javascript
var angles =[0,0,0]; // Tait-Bryant angles about X, Y and Z, in degrees
function spin() {
    viewer.setRotate("saw#2", angles);
    angles[1] += 0.1;
    requestAnimationFrame(spin);
}
spin();
`````

Get an object's translation, scale and rotation:
````javascript
var translate = viewer.setTranslate("saw");
var scale = viewer.setScale("saw");
var rotate = viewer.setRotate("saw");
`````

## Showing and hiding models and objects

You can independently show and hide each object in your viewer.

Show everything in a viewer:
````javascript
viewer.show();
`````

Hide everything in a viewer:
````javascript
viewer.hide();
````

Show all objects within a model:
````javascript
viewer.show("saw");
````

Hide all objects within a model:
````javascript
viewer.hide("saw");
````

Show given objects:
````javascript
viewer.show(["saw#1", "saw#5"]);
````

Show all objects of the given types:
````javascript
viewer.show(["IfcFlowController", "IfcFlowFitting"]);
````

Show a model and two objects:
````javascript
viewer.show(["saw", "saw#1", "saw#5"]);
````

Hide a model, two objects and all objects of the given type:
````javascript
viewer.hide(["saw", "saw#1", "saw#5", "IfcFlowFitting"]);
````

## Picking objects

You can select objects by picking or raycasting. Picking involves finding objects at given canvas coordinates,
while raycasting involves finding objects that intersect an arbitrarily-positioned World-space ray.

For both of these, you have the option of getting either just the object, or the object plus information
about the 3D point that you've picked or raycasted on its surface.

Picking the object at the given canvas coordinates:
````javascript
var hit = viewer.pickObject([234, 567]);
if (hit) {
    console.log("object picked: " + hit.id);
}
````

Picking a point on the surface of an object, at the given canvas coordinates:
````javascript
hit = viewer.pickSurface([234, 567]);
if (hit) {
    var worldPos = hit.worldPos;
    console.log("object picked: " + hit.id);
    console.log("surface coordinates: " + worldPos[0] + "," + worldPos[1] + "," + worldPos[2]);
}
````

Getting the object that intersects a ray:
````javascript
hit = viewer.rayCastObject([0,0,-100], [0,0,1]); // Origin, dir
if (hit) {
    console.log("object raycasted: " + hit.id);
}
````

Getting object and point of surface intersection with a World-space ray:
````javascript
hit = viewer.rayCastSurface([0,0,-100], [0,0,1]); // Origin, dir
if (hit) {
    var worldPos = hit.worldPos;
    console.log("object raycasted: " + hit.id);
    console.log("surface coordinates: " + worldPos[0] + "," + worldPos[1] + "," + worldPos[2]);
}
````

## Outlining objects

You can emphasize objects in your viewer by displaying outlines around them.

[![](http://xeolabs.com/xeometry/assets/sawObjects.png)](http://xeogl.org/examples/#presentation_annotations_tronTank)

## Clipping

You can create an unlimited number of arbitrarily-positioned clipping planes in your viewer, as well as specify which
objects are clipped by them.

[![](http://xeolabs.com/xeometry/assets/sawObjects.png)](http://xeogl.org/examples/#presentation_annotations_tronTank)

## Annotations

An annotation is a labeled pin that's attached to the surface of an object.

[![](http://xeolabs.com/xeometry/assets/sawObjects.png)](http://xeogl.org/examples/#presentation_annotations_tronTank)

An annotation is pinned within a triangle of an object's geometry, at a position given in barycentric coordinates. A
barycentric coordinate is a three-element vector that indicates the position within the triangle as a weight per vertex,
where a value of [0.3,0.3,0.3] places the annotation at the center of its triangle.

An annotation can be configured with an optional camera position from which to view it, given as eye, look and up vectors.

By default, an annotation will be invisible while occluded by other objects in the 3D view.

Note that when you pick an object with #.Viewer#rayCastSurface or #.Viewer#pickSurface, you'll get a triangle index and
barycentric coordinates in the intersection result. This makes it convenient to create annotations directly from pick
results.

TODO: examples

## Canvas snapshots

You can grab a snapshot image of your viewer at any time, as a JPEG, PNG or BMP.

Snapshots are taken asynchronously.

Grab a PNG image of the canvas, scaled to 500x500 pixels:
````javascript
var image = new Image();

viewer.getSnapshot({
    width: 500, // Defaults to size of canvas
    height: 500,
    format: "png" // Options are "jpeg" (default), "png" and "bmp"
}, function (imageData) {
    image.src = imageData;
});
````

## Viewer bookmarks

You can save and restore the state of a viewer as a JSON bookmark. A bookmark contains all the viewer's state, including:

 * models loaded,
 * object visibilities, opacities, outlines and types
 * model and object transforms
 * camera position and projection
 * annotations
 * clipping planes
 * outline appearance

Save model state to JSON bookmark, clear model then restore it again from the bookmark:
````javascript
var json = viewer.getBookmark();
viewer.reset();
viewer.setBookmark(json, function() { /* Loaded */ });
````

## Building


