# xeoviz

A light and tasty [glTF](http://gltf.org) model viewer built with [xeogl](http://xeogl.org).     


## Features

* Load multiple glTF models
* Show and hide models and objects
* Scale, rotate and translate models and objects
* Fly camera to look at models and objects
* Save and load viewer state as JSON

## Examples

* [Load glTF model and fit it to view](example1.html)
* [Load glTF model and fly camera to random objects](example2.html)
* [Load glTF model and reveal its objects one at a time](example3.html)
* [Load two glTF models and show them alternately](example4.html)
* [Load glTF model and cycle through its objects](example5.html)

## Usage

#### Creating and destroying viewers

Create a viewer with a default canvas that fills the page:
````javascript
var viewer = new xeoviz();
````

Create a viewer with an existing canvas:
````javascript
var viewer = new xeoviz({
    canvasId: "myCanvas"
});
````

You can create multiple viewers in the same page. 

Destroy a viewer:
````javascript
viewer.destroy();
````

#### Loading and unloading models

You can load multiple glTF models into a viewer at the same time. You can also load separate copies of the same model.

Load two glTF models into a viewer:
````javascript
viewer.load("gearbox", "./GearboxAssy.gltf",
    function () {
    
        viewer.load("saw", "./Reciprocating_Saw.gltf",
            function () {
                //... two models loaded
            });
    });
````

Unload a model:
````javascript
viewer.unload("gearbox");
````

#### Querying models and objects

You can query the IDs of whatever models and objects are currently loaded.

Get IDs of all models:
````javascript
var models = viewer.models();
````

Get IDs of all objects:
````javascript
var objects = viewer.objects();
````

Get IDs of all objects within a model:
````javascript
var sawObjects = viewer.objects("saw");
````

Get IDs of whatever objects intersect the given boundary:
````javascript
var sawObjects = viewer.objects([-100,-100,-100,100,100,100]);
````

#### Querying boundaries of models and objects

Everything within a viewer can be queried for its axis-aligned World-space boundary, which is given as an array containing
values ````[xmin, ymin, zmin, xmax, ymax, zmax]````.

Get the collective boundary of everything in a viewer:
````javascript
var allBoundary = viewer.aabb();
````

Get the boundary of a model:
````javascript
var sawBoundary = viewer.aabb("saw");
````

Get collective boundary of some objects:
````javascript
var objectsBoundary = viewer.aabb(["foo", "bar"]);
````

Get collective boundary of some models:
````javascript
var modelsBoundary = viewer.aabb(["saw", "gearbox"]);
````

Get collective boundary of the first five objects within a given model:
````javascript
var objectsBoundary2 = viewer.aabb(viewer.objects("saw").slice(0, 5));
````

Get collective boundary of a model and a couple of objects:
````javascript
var objectsBoundary3 = viewer.aabb(["saw", "outerCasing", "trigger");
````

#### Transforming models and objects

Each model and object can be independently transformed within a viewer. A transformation consists of the following
 operations, applied in this order:

 * scale
 * X-axis rotation (degrees),
 * Y-axis rotation,
 * Z-axis rotation
 * translation

Transform a model, move it along the X axis, scale it, then rotate it 90 degrees about its X-axis:
````javascript
viewer.translate("saw", [100,0,0]);
viewer.scale("saw", [0.5,0.5,0.5]);
viewer.rotate("saw", [90,0,0]);
`````

Spin an object about its Y-axis:
````javascript
var angles =[0,0,0]; // Tait-Bryant angles about X, Y and Z, in degrees
function spin() {
    viewer.rotate("outerCasing", angles);
    angles[1] += 0.1;
    requestAnimationFrame(spin);
}
spin();
`````

Get an object's translation, scale and rotation:
````javascript
var translate = viewer.translate("saw");
var scale = viewer.scale("saw");
var rotate = viewer.rotate("saw");
`````

#### Showing and hiding models and objects

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
viewer.show(["outerCover", "trigger"]);
````

Show a model and two objects:
````javascript
viewer.show(["saw", "outerCover", "trigger"]);
````

#### Controlling the camera

The camera position can be updated at any time. The camera can also be made to fit the view to given models and
objects, either by flying or jumping to a new position.

Get camera eye, look and "up" vector:
````javascript
var eye = viewer.eye();
var look = viewer.look();
var up = viewer.up();
````

Set camera eye, look and "up" vectorp:
````javascript
viewer.eye([0,0,-100]);
viewer.look([0,0,0]);
viewer.up([0,1,0]);
````

Switch camera to "flight" mode, where it will animate to each new position:
````javascript
viewer.flight(true);
````
Set how fast the camera flies to each new position:
````javascript
viewer.flightDuration(2); // Seconds
var duration = viewer.flightDuration();
````

Get the current camera mode:
````javascript
var flight = viewer.flight();
````

Fly camera to given position:
````javascript
// Eye, look and "up" vector
viewer.lookat([0,0,-100],[0,0,0],[0,1,0], function() { 
    // Camera arrived
});
````

Fly camera to fit everything within view:
````javascript
viewer.goto(function() {
    // Camera arrived
});
````

Fly camera to fit a model:
````javascript
viewer.goto("saw", function() {
    // Camera arrived
});
````

Fly camera to fit two models:
````javascript
viewer.goto(["saw", "gearbox"] function() {
    // Camera arrived
});
````

Switch camera to "jump" mode, where it will jump directly to each new position:
````javascript
viewer.flight(false);
````

Jump camera to fit two objects - note we don't need the callback anymore because camera is now jumping:
````javascript
viewer.goto(["foo", "bar"]);
````

Jump camera to fit a model and two objects:
````javascript
viewer.goto(["saw", "outerCasing", "trigger"]);
````

Set how much of the fit-of-view that a target boundary will occupy when flying the camera to fit models or objects to the view:
````javascript
viewer.flightDuration(2); // Seconds
var duration = viewer.flightDuration();
````

#### Saving and loading viewer state

You can save and restore the state of a viewer as a JSON bookmark. The bookmark will include:

 * models loaded,
 * model and object visibilities
 * model and object transforms
 * camera position

Save model state to JSON bookmark, clear model the restore it again from the bookmark:
````javascript
var json = viewer.bookmark();
viewer.reset();
viewer.bookmark(json);
````
