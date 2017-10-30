# xeometry

**xeometry** is an open source \(MIT\) JavaScript library from [@xeographics](https://twitter.com/xeographics) for viewing and interacting with 3D glTF models on WebGL. 

Use it to build 3D viewer apps, or program custom interactive presentations of glTF content.

* [Programming Guide](https://www.gitbook.com/book/xeolabs/xeometry-guide/details)
* [API Docs](http://xeometry.org/docs)
* [Examples](http://xeometry.org/examples)
* [Downloads](https://github.com/xeolabs/xeometry/releases)
* [Source code](https://github.com/xeolabs/xeometry)

[![](http://xeolabs.com/xeometry/assets/transparency.png)](http://xeolabs.com/xeometry/examples/#effects_transparency)

````javascript
var viewer = new xeometry.Viewer({ canvasId: "theCanvas" });

viewer.loadModel("saw", "models/Reciprocating_Saw.gltf", function () {
     viewer.setOpacity(["saw#0", "saw#1", "saw#2", "saw#3", "saw#11"], 0.3);
     viewer.viewFit("saw");
});
````
\[ [_Run this example_](http://xeolabs.com/xeometry/examples/#effects_transparency) \]
