# xeometry

[**xeometry**](http://xeometry.org) is an open source \(MIT\) JavaScript library from [@xeographics](https://twitter.com/xeographics) for viewing and interacting with 3D glTF models on WebGL. 

It lets you load multiple models and show, hide, move, query, measure, xray, slice and annotate their objects, through a set of simple data-driven functions. Use it to build 3D viewer apps and custom interactive presentations of glTF content.

* [Programming Guide](https://www.gitbook.com/book/xeolabs/xeometry-guide/details)
* [API Documentation](http://xeometry.org/docs)
* [Examples](http://xeometry.org/examples)
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
