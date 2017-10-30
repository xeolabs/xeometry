# xeometry

**xeometry** is an open source \(MIT\) JavaScript library from [@xeographics](https://twitter.com/xeographics) for viewing and interacting with 3D glTF models on WebGL. 

Use it to build 3D viewer apps, or program custom interactive presentations of glTF content.

* [Programming Guide](https://www.gitbook.com/book/xeolabs/xeometry-guide/details)
* [API Docs](http://xeometry.org/docs)
* [Examples](http://xeometry.org/examples)
* [Downloads](https://github.com/xeolabs/xeometry/releases)
* [Source code](https://github.com/xeolabs/xeometry)

[![](https://xeolabs.gitbooks.io/xeometry-guide/content/assets/transforms.png)](http://xeolabs.com/xeometry/examples/#effects_transforming)

````javascript
var viewer = new xeometry.Viewer();

viewer.setEye([53.06, -198.07, 302.47]);
viewer.setLook([-110.88, -24.57, 87.87]);
viewer.setUp([0.38, 0.76, 0.50]);

viewer.loadModel("saw", "ReciprocatingSaw.gltf", function () {
    viewer.setRotate("saw", [90, 0, 0]);
    viewer.setTranslate("saw#3.1", [0, 80, -50]);
    viewer.setRotate("saw#3.1", [-90, 0, 0]);
});
````
\[ [_Run this example_](http://xeolabs.com/xeometry/examples/#effects_transforming) \]
