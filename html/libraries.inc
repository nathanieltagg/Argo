<!-- This library lets me use text functions for non-html5-compliant browsers, using the closest-thing-to-native you can get. -->
<!-- General-purpose javascript library to help cross-platform compatibility and other issues. see http://jquery.com -->

<link href="css/le-frog/jquery-ui-1.10.4.custom.css" rel="stylesheet">
<link href="css/le-frog/jquery-ui-1.10.4.custom.min.css" rel="stylesheet">

<!-- <script src="js/jquery-1.9.0.js"></script> -->
<!-- <script src="js/jquery-ui-1.10.0.custom.js"></script> -->
<script src="js/jquery-2.1.0.min.js"></script>
<script src="js/jquery-ui-1.10.4.custom.min.js"></script>

<!-- IE detection -->
<script type="text/javascript" src="js/modernizr.js"></script>
<script type="text/javascript" src="libs/check_browser.js"></script>


<script type="text/javascript" src="js/jquery.mousewheel.min.js"></script>
<script type="text/javascript" src="js/ajax-upload.3.5.js"></script>
<script type="text/javascript" src="js/jquery.cookie.js"></script>
<script type="text/javascript" src="js/jquery.blockUI.js"></script>
<script type="text/javascript" src="js/jquery.ba-resize.min.js"></script>
<script type="text/javascript" src="js/jquery.hotkeys.js"></script>
<script type="text/javascript" src="js/sylvester.js"></script>
<script type="text/javascript" src="js/canvas.text.js"></script>
<script type="text/javascript" src="js/jquery.ba-hashchange.js"></script>
<script type="text/javascript" src="js/jquery.ba-bbq.min.js"></script>
<script type="text/javascript" src="js/jit.js"></script>



<!-- for creating animated gifs. -->
<script type="text/javascript" src="js/LZWEncoder.js"></script>
<script type="text/javascript" src="js/NeuQuant.js"></script>
<script type="text/javascript" src="js/GIFEncoder.js"></script>
<script type="text/javascript" src="js/b64.js"></script>


<!-- firebug lite, for debugging on random browswers. -->
<!-- <script type='text/javascript' 
        src='http://getfirebug.com/releases/lite/1.2/firebug-lite-compressed.js'></script> -->
<script type="text/javascript">
  if (window['loadFirebugConsole']) {
      window.loadFirebugConsole();
  } else {
    if (!window['console'])   window.console = {};
    if (!window.console['time']      ) window.console.time        = function(){};
    if (!window.console['timeEnd']   ) window.console.timeEnd     = function(){};
    if (!window.console['debug']     ) window.console.debug       = function(){};
    if (!window.console['info']      ) window.console.info        = function(){};
    if (!window.console['log']       ) window.console.log         = function(){};
    if (!window.console['warn']      ) window.console.warn        = function(){};
    if (!window.console['profile']   ) window.console.profile     = function(){};
    if (!window.console['profileEnd']) window.console.profileEnd  = function(){};
    if (!window.console['trace']     ) window.console.trace       = function(){};
    if (!window.console['error']     ) window.console.error       = function(){};
  }
</script>

<!--Core. -->
<script type="text/javascript" src="core/ABoundObject.js"></script>
<script type="text/javascript" src="core/Pad.js"></script>
<script type="text/javascript" src="core/ButtressedPad.js"></script>
<script type="text/javascript" src="core/ColorScale.js"></script>
<script type="text/javascript" src="core/StateMachine.js"></script>
<script type="text/javascript" src="core/Histogram.js"></script>
<script type="text/javascript" src="core/HistCanvas.js"></script>
<script type="text/javascript" src="core/GraphCanvas.js"></script>
<script type="text/javascript" src="core/Pad3d.js"></script>
<script type="text/javascript" src="core/Printing.js"></script> 
<script type="text/javascript" src="core/GeometryUtils.js"></script> 
<script type="text/javascript" src="core/DreamyScan.js"></script> 


<!-- My classes for doing histograming and other displays-->
<script type="text/javascript" src="libs/Geometry.js"></script> 
<script type="text/javascript" src="libs/Configuration.js"></script> 
<script type="text/javascript" src="libs/DataSource.js"></script> 
<script type="text/javascript" src="libs/Keyboard.js"></script> 

<script type="text/javascript" src="libs/SelectionAndHover.js"></script> 

<script type="text/javascript" src="libs/EventInfo.js"></script> 
<script type="text/javascript" src="libs/HitHistogram.js"></script> 
<script type="text/javascript" src="libs/TimeHistogram.js"></script> 
<script type="text/javascript" src="libs/WireHistogram.js"></script> 
<script type="text/javascript" src="libs/WireView.js"></script> 
<script type="text/javascript" src="libs/WireInfo.js"></script> 
<script type="text/javascript" src="libs/ZoomControl.js"></script> 
<script type="text/javascript" src="libs/MCInfo.js"></script> 
<script type="text/javascript" src="libs/MCDigraph.js"></script> 
<script type="text/javascript" src="libs/TriDView.js"></script> 
<script type="text/javascript" src="libs/OpTimeHistogram.js"></script> 
<script type="text/javascript" src="libs/OpHitMap.js"></script> 
<script type="text/javascript" src="libs/MRI.js"></script> 
<script type="text/javascript" src="libs/dEdXTool.js"></script> 
<script type="text/javascript" src="libs/ArgoDreamyScan.js"></script> 
<script type="text/javascript" src="libs/SaveSelection.js"></script> 


<!-- My classes for talking to the back-end and other displays-->
<script type="text/javascript" src="libs/QueryServer.js"></script> 
<script type="text/javascript" src="libs/ArgoData.js"></script> 

<!-- Main scripts. Start here. -->
<script type="text/javascript" src="libs/argo.js" ></script>
