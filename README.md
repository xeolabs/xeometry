# xeoviz

A super lightweight API for viewing glTF models and creating custom views.

### Loading glTF models

````javascript
viewer.load("gearbox", "./GearboxAssy.gltf", function () {
    
    viewer.load("saw", "./Reciprocating_Saw.gltf", function () {        
        //... two models loaded
    });
});
````

### Querying models

Get the IDs of loaded models:
````javascript
var models = viewer.models();
````

Get the IDs of objects within a model:
````javascript
var sawObjects = viewer.objects("saw");
````

Get the boundary of a model (axis-aligned, in World-space):
````javascript
var sawBoundary = viewer.aabb("saw");
````

Get the boundary of all models:

````javascript
var sceneBoundary = viewer.aabb();
````

Get boundary of some objects:
````javascript
var objectsBoundary = viewer.aabb(["foo", "bar"]);
````

### Transforming things

````javascript

````

### Showing and hiding things  

### Camera control

Switch camera between "flight" mode and "jump" mode:

````javascript
viewer.flight(true);
````

Fly camera to fit view to a model:

````javascript
viewer.goto("saw", function() {
    // Camera arrived
});
````

Fly camera to a couple of objects:
````javascript
viewer.goto(["foo", "bar"], function() {
    // Camera arrived
});
````



### Bookmarking


