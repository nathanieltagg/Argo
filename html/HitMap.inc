    <div class="portlet" id="hit-map-port"> 
      <div class="portlet-header">Hit Maps</div>
      <div id="hitmaps" class="portlet-content">
        
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

