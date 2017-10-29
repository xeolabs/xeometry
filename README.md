# xeometry

xeometry is an open source JavaScript API for viewing glTF models on WebGL.

* [xeometry.org](http://xeometry.org)
* [Guide Book](https://xeolabs.gitbooks.io/xeometry-guide/content/)
* [Examples](http://xeometry.org/examples)
* [API Documentation](http://xeometry.org/docs)
* [Downloads](https://github.com/xeolabs/xeometry/releases)
* [Source code](https://github.com/xeolabs/xeometry)

[![](http://xeolabs.com/xeometry/assets/transparency.png)](http://xeolabs.com/xeometry/examples/#guidebook_transparency)

````javascript
var viewer = new xeometry.Viewer({ canvasId: "theCanvas" });

viewer.loadModel("saw", "models/Reciprocating_Saw.gltf", function () {
     viewer.setOpacity(["saw#0", "saw#1", "saw#2", "saw#3", "saw#11"], 0.3);
     viewer.viewFit("saw");
});
````
