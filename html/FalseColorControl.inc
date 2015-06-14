<style>
.psuedoColorRow{ display:flex; display:-webkit-flex;}
.psuedoColorRow .pslabel{ flex-basis: 40px}
.psuedoColorRow .psslide{ display:inline-block; flex-grow: 1; }
.psuedoColorRow .psval  { font-size: 0.7em;  flex-basis:25px; flex-grow:0; }
</style>
<div class="portlet" id="falsecolorcontrol-port"> 
  <div class="portlet-header">Wire False Color</div>
  <div class="portlet-content">
    <div class="A-FalseColorControl" style="height: 120px"></div>
    <!-- <select class="false-color-type saveable" id="false-color-type">
      <option value="1"     selected="selected">Blue-Green</option> -->
      <!-- <option value="2"                        >Threshold</option> -->
    </select>
    <!-- <button class="falseColorMinus1">-1</button>
    <button class="falseColorPlus1">+1</button> -->
    <div class='psuedoColorRow' > <span class='pslabel'>Shift</span>
              <div id='psuedoDialOffsetSlider' class='psslide'></div>
              <input class='psval savable' type="number" id='psuedoDialOffset' value='-0.17503753776026354' width='3'/></div>

    <div class='psuedoColorRow' > <span class='pslabel'>Warp</span> 
              <div id='psuedoAdcScaleSlider'class='psslide'></div> 
              <input class='psval savable'  type="text" id='psuedoAdcScale' value='20' width='3'/> </div>

    <div class='psuedoColorRow' > <span class='pslabel'>Scale</span>
              <div id='psuedoDialScaleSlider' class='psslide'></div>
              <input class='psval savable'  type="text" id='psuedoDialScale' value='0.8' width='3'/> </div>

    <div class='psuedoColorRow' > <span class='pslabel'>Satr</span>
              <div id='psuedoSaturationSlider' class='psslide'></div>
              <input class='psval savable'  type="text" id='psuedoSaturation' value='0.9' width='3'/> </div>
  </div>
</div>


