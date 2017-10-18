# xeometry

xeometry is an open source JavaScript API for viewing glTF models on WebGL.

* [Downloads](https://github.com/xeolabs/xeometry/releases)
* [API Documentation](http://xeolabs.com/xeometry/docs)
* [Examples](http://xeolabs.com/xeometry/examples)
* [User Guide](https://www.gitbook.com/book/xeolabs/xeometry/details)
* [Slack Workspace](https://xeometry.slack.com)

[![](http://xeolabs.com/xeometry/assets/sawObjects.png)](http://xeolabs.com/xeometry/examples/#effects_opacity)

````javascript
var viewer = new xeometry.Viewer({ canvasId: "theCanvas" });

viewer.loadModel("saw", "models/Reciprocating_Saw.gltf", function () {
     viewer.setOpacity(["saw#0", "saw#1", "saw#2", "saw#3", "saw#11"], 0.3);
     viewer.viewFit("saw");
});
````
