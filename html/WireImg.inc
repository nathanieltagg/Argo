<div class="portlet" id="wireimg-port"> 
<div class="portlet-header">Wire Data</div>
<div id="wireimg-tabs" class="BuildTabs" class="portlet-content">
  
  <ul>
    <li><a href="#wireimg-raw">Raw</a></li>
    <li><a href="#wireimg-cal">Calibrated</a></li>
    <li><a href="#wireimg-hitmap">Hits</a></li>
    
  </ul>
  


<div id="wireimg-cal">
  <div style="width: 33.3%;float: left;">
    <span style="center">Calibrated Plane 0</span>
    <div class="pad A-WireView" style="width:100%; height:300px" settings="plane: 0, show_mc:true,show_image:'cal'"></div>
  </div>
  
  <div style="width: 33.3%;float: right;">
    <span style="center">Calibrated Plane 2</span>
    <div class="pad A-WireView" style="width:100%; height:300px" settings="plane: 2, show_mc:true,show_image:'cal'"></div>
  </div>

  <div style="width: 33.3%; margin-left: 33.35%"            >
    <span style="center">Calibrated Plane 1</span>  
    <div class="pad A-WireView" style="width:100%; height:300px" settings="plane: 1, show_mc:true,show_image:'cal'"></div>
  </div>
</div>


<div id="wireimg-raw">
  <div style="width: 33.3%;float: left;">
    <span style="center">Raw View 0</span>
    
    <div class="pad A-WireView" style="width:100%; height:300px" settings="plane: 0, show_image:'raw'"></div>
  </div>
  
  <div style="width: 33.3%;float: right;">
    <span style="center">Raw View 2</span>
    
    <div class="pad A-WireView" style="width:100%; height:300px" settings="plane: 2, show_image:'raw'"></div>
  </div>

  <div style="width: 33.3%; margin-left: 33.35%">
    <span style="center">Raw View 1</span>    
    <div class="pad A-WireView" style="width:100%; height:300px" settings="plane: 1, show_image:'raw'"></div>
  </div>
</div>

<div id="wireimg-hitmap">
  <div style="width: 33.3%;float: left;">
    <span><center>Plane 0</center></span>
    <div class="pad A-WireView" style="width: 100%;  height:300px;" id="ut" 
          settings="plane: 0, show_hits:true, show_image: false, zooming: true,  min_u:0, max_u: 3456, num_u:70, min_v:0, max_v:3500, num_v:70, margin_left:38, margin_bottom:35 ,ylabel:'Time', xlabel:'Wire', label_font:'12px sans-serif'">
        </div>
  </div>

  <div style="width: 33.3%; float: right">
    <span><center>Plane 2</center></span>
    <div class="pad A-WireView" style="width: 100%; height:300px;"  id="vt" 
    settings="plane: 2, show_hits:true, show_image: false, zooming: true, min_u:0, max_u: 2398, num_u:70, min_v:0, max_v:3500, num_v:70, margin_left:38, margin_bottom:35 ,ylabel:'Time', xlabel:'Wire', label_font:'12px sans-serif'">
  </div>
  </div>

  <div style="width: 33.3%; margin-left: 33.35%"            >
    <span><center>Plane 1</center></span>
    <div class="pad A-WireView"  style="width: 100%;  height:300px;" id="wt" 
    settings="plane: 1, show_hits:true, show_image: false, zooming: true, min_u:0, max_u: 2398, num_u:70, min_v:0, max_v:3500, num_v:70, margin_left:38, margin_bottom:35 ,ylabel:'Time', xlabel:'Wire', label_font:'12px sans-serif'">
  </div>
  </div>

</div>

</div>
</div>  <!-- portlet -->
