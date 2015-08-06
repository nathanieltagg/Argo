<style>
.psuedoColorRow{ display:flex; display:-webkit-flex;}
.psuedoColorRow .pslabel{ flex-basis: 40px}
.psuedoColorRow .psslide{ display:inline-block; flex-grow: 1; }
.psuedoColorRow .psval  { font-size: 0.7em;  flex-basis:25px; flex-grow:0; }
</style>
<div class="portlet" id="falsecolorcontrol-port"> 
  <div class="portlet-header">Wire False Color</div>
  <div class="portlet-content">
  <div class="A-FalseColorControl">

 <!-- <select class="false-color-type saveable" id="false-color-type">
   <option value="1"     selected="selected">Blue-Green</option> -->
   <!-- <option value="2"                        >Threshold</option> -->
 <!-- </select> -->
 <!-- <button class="falseColorMinus1">-1</button>
 <button class="falseColorPlus1">+1</button> -->
      <div class="hist-element" style="height: 120px"></div>
      <input type="hidden" id="falsecolor-scheme" value="falsecolor-Rainbow" class='saveable'/>

  	<ul>
      <li><a href="#falsecolor-Rainbow">Rainbow</a></li>
      <li><a href="#falsecolor-Grayscale">Gray</a></li>
      <li><a href="#falsecolor-LOCS">LOCS</a></li>
      <li><a href="#falsecolor-Brightness">Bright</a></li>
      <li><a href="#falsecolor-Blackbody">BB</a></li>
      <li><a href="#falsecolor-Interp2">Intp2</a></li>
      
  	</ul>
    
    <div id="falsecolor-Rainbow" class='falsecolor-tab'>
 
    
      Hue-rotation <br/>
      <div class='psuedoColorRow' > <span class='pslabel'>Shift</span>
                <div class='psslide psuedoDialOffsetSlider'></div>
                <input id='falsecolor-rainbow-dialoffset' class='psval saveable psuedoDialOffset' type="number" value='-0.17503753776026354' width='3'/></div>

      <div class='psuedoColorRow' > <span class='pslabel'>Warp</span> 
                <div class='psslide psuedoAdcScaleSlider'></div> 
                <input id='falsecolor-rainbow-adcscale' class='psval saveable psuedoAdcScale'  type="text"  value='20' width='3'/> </div>

      <div class='psuedoColorRow' > <span class='pslabel'>Scale</span>
                <div class='psslide psuedoDialScaleSlider'></div>
                <input id='falsecolor-rainbow-dialscale' class='psval saveable psuedoDialScale'  type="text"  value='0.8' width='3'/> </div>

      <div class='psuedoColorRow' > <span class='pslabel'>Satr</span>
                <div class='psslide psuedoSaturationSlider'></div>
                <input id='falsecolor-rainbow-saturation' class='psval saveable psuedoSaturation'  type="text" value='0.9' width='3'/> </div>

      <div class='psuedoColorRow'> Cutoff: &nbsp;
        <input id='falsecolor-rainbow-cutlow' class='psval saveable psuedoCutoffLow'  type="text"  value='0' width='5'/>&nbsp; to &nbsp;
        <input id='falsecolor-rainbow-cuthigh'class='psval saveable psuedoCutoffHigh'  type="text" value='0' width='5'/></span>&nbsp; ADC &nbsp;
      </div>

    </div>



    <div id="falsecolor-Grayscale" class='falsecolor-tab'>
      Grayscale <br/>
      <div class='psuedoColorRow' > <span class='pslabel'>Shift</span>
                <div class='psslide psuedoDialOffsetSlider'></div>
                <input id='falsecolor-grayscale-dialoffset' class='psval saveable psuedoDialOffset' type="number" value='0' width='3'/></div>

      <div class='psuedoColorRow' > <span class='pslabel'>Warp</span> 
                <div class='psslide psuedoAdcScaleSlider'></div> 
                <input id='falsecolor-grayscale-adcscale' class='psval saveable psuedoAdcScale'  type="text"  value='20' width='3'/> </div>

      <div class='psuedoColorRow' > <span class='pslabel'>Scale</span>
                <div class='psslide psuedoDialScaleSlider'></div>
                <input id='falsecolor-grayscale-dialscale' class='psval saveable psuedoDialScale'  type="text"  value='0.5' width='3'/> </div>

      <!-- <div class='psuedoColorRow' > <span class='pslabel'>Satr</span>
                <div class='psslide psuedoSaturationSlider'></div>
                <input id='falsecolor-grayscale-saturation' class='psval saveable psuedoSaturation'  type="text" value='0.9' width='3'/> </div> -->

      <div class='psuedoColorRow'> Cutoff: &nbsp;
        <input id='falsecolor-grayscale-cutlow' class='psval saveable psuedoCutoffLow'  type="text"  value='0' width='5'/>&nbsp; to &nbsp;
        <input id='falsecolor-grayscale-cuthigh'class='psval saveable psuedoCutoffHigh'  type="text" value='0' width='5'/></span>&nbsp; ADC &nbsp;
      </div>
    </div>
    
    <div id="falsecolor-LOCS" class='falsecolor-tab'>
      Linearized Optimal Color Scale <br/>
      <div class='psuedoColorRow' > <span class='pslabel'>Shift</span>
                <div class='psslide psuedoDialOffsetSlider'></div>
                <input id='falsecolor-grayscale-dialoffset' class='psval saveable psuedoDialOffset' type="number" value='0' width='3'/></div>

      <div class='psuedoColorRow' > <span class='pslabel'>Warp</span> 
                <div class='psslide psuedoAdcScaleSlider'></div> 
                <input id='falsecolor-grayscale-adcscale' class='psval saveable psuedoAdcScale'  type="text"  value='20' width='3'/> </div>

      <div class='psuedoColorRow' > <span class='pslabel'>Scale</span>
                <div class='psslide psuedoDialScaleSlider'></div>
                <input id='falsecolor-grayscale-dialscale' class='psval saveable psuedoDialScale'  type="text"  value='0.5' width='3'/> </div>
      <!-- <div class='psuedoColorRow' > <span class='pslabel'>Satr</span>
                <div class='psslide psuedoSaturationSlider'></div>
                <input id='falsecolor-locs-saturation' class='psval saveable psuedoSaturation'  type="text" value='0.9' width='3'/> </div> -->

      <div class='psuedoColorRow'> Cutoff: &nbsp;
        <input id='falsecolor-locs-cutlow' class='psval saveable psuedoCutoffLow'  type="text"  value='0' width='5'/>&nbsp; to &nbsp;
        <input id='falsecolor-locs-cuthigh'class='psval saveable psuedoCutoffHigh'  type="text" value='0' width='5'/></span>&nbsp; ADC &nbsp;
      </div>
    </div>
    


    <div id="falsecolor-Brightness" class='falsecolor-tab'>
      Simple Brightness on Color <br/>
      <div class='psuedoColorRow' > <span class='pslabel'>Shift</span>
                <div class='psslide psuedoDialOffsetSlider'></div>
                <input id='falsecolor-brightness-dialoffset' class='psval saveable psuedoDialOffset' type="number" value='0' width='3'/></div>

      <div class='psuedoColorRow' > <span class='pslabel'>Warp</span> 
                <div class='psslide psuedoAdcScaleSlider'></div> 
                <input id='falsecolor-brightness-adcscale' class='psval saveable psuedoAdcScale'  type="text"  value='20' width='3'/> </div>

      <div class='psuedoColorRow' > <span class='pslabel'>Scale</span>
                <div class='psslide psuedoDialScaleSlider'></div>
                <input id='falsecolor-brightness-dialscale' class='psval saveable psuedoDialScale'  type="text"  value='0.5' width='3'/> </div>
      <div class='psuedoColorRow' > <span class='pslabel'>Hue</span>
                <div class='psslide psuedoSaturationSlider'></div>
                <input id='falsecolor-brightness-saturation' class='psval saveable psuedoSaturation'  type="text" value='0.5' width='3'/> </div>

      <div class='psuedoColorRow'> Cutoff: &nbsp;
        <input id='falsecolor-locs-cutlow' class='psval saveable psuedoCutoffLow'  type="text"  value='0' width='5'/>&nbsp; to &nbsp;
        <input id='falsecolor-locs-cuthigh'class='psval saveable psuedoCutoffHigh'  type="text" value='0' width='5'/></span>&nbsp; ADC &nbsp;
      </div>
    </div>
    
    
    
    
    <div id="falsecolor-Blackbody" class='falsecolor-tab'>
      Simulated blackbody spectrum 1000K to 40000K<br/>
      <div class='psuedoColorRow' > <span class='pslabel'>Shift</span>
                <div class='psslide psuedoDialOffsetSlider'></div>
                <input id='falsecolor-blackbody-dialoffset' class='psval saveable psuedoDialOffset' type="number" value='0.25' width='3'/></div>

      <div class='psuedoColorRow' > <span class='pslabel'>Warp</span> 
                <div class='psslide psuedoAdcScaleSlider'></div> 
                <input id='falsecolor-blackbody-adcscale' class='psval saveable psuedoAdcScale'  type="text"  value='20' width='3'/> </div>

      <div class='psuedoColorRow' > <span class='pslabel'>Scale</span>
                <div class='psslide psuedoDialScaleSlider'></div>
                <input id='falsecolor-blackbody-dialscale' class='psval saveable psuedoDialScale'  type="text"  value='0.4' width='3'/> </div>
      <!-- <div class='psuedoColorRow' > <span class='pslabel'>Satr</span>
                <div class='psslide psuedoSaturationSlider'></div>
                <input id='falsecolor-locs-saturation' class='psval saveable psuedoSaturation'  type="text" value='0.9' width='3'/> </div> -->

      <div class='psuedoColorRow'> Cutoff: &nbsp;
        <input id='falsecolor-blackbody-cutlow' class='psval saveable psuedoCutoffLow'  type="text"  value='0' width='5'/>&nbsp; to &nbsp;
        <input id='falsecolor-blackbody-cuthigh'class='psval saveable psuedoCutoffHigh'  type="text" value='0' width='5'/></span>&nbsp; ADC &nbsp;
      </div>
    </div>



    <div id="falsecolor-Interp2" class='falsecolor-tab'>
      Two-color control point interpolation in RGB space<br/>
      <div class='psuedoColorRow' > <span class='pslabel'>Color 0</span>
                <input  type="text" data-index='0' id='falsecolor-interp2-color0'  class='saveable psuedo-color colorpicker' value='#FFFFFF'/>
              </div>
      <div class='psuedoColorRow' > <span class='pslabel'>Color 1</span>
                <input  type="text" data-index='1' id='falsecolor-interp2-color1'  class='saveable psuedo-color colorpicker' value='#0000FF'/>
              </div>

      <div class='psuedoColorRow' > <span class='pslabel'>Shift</span>
                <div class='psslide psuedoDialOffsetSlider'></div>
                <input id='falsecolor-interp2-dialoffset' class='psval saveable psuedoDialOffset' type="number" value='-0.5' width='3'/></div>

      <div class='psuedoColorRow' > <span class='pslabel'>Warp</span> 
                <div class='psslide psuedoAdcScaleSlider'></div> 
                <input id='falsecolor-interp2-adcscale' class='psval saveable psuedoAdcScale'  type="text"  value='20' width='3'/> </div>

      <div class='psuedoColorRow' > <span class='pslabel'>Scale</span>
                <div class='psslide psuedoDialScaleSlider'></div>
                <input id='falsecolor-interp2-dialscale' class='psval saveable psuedoDialScale'  type="text"  value='0.25' width='3'/> </div>

      <div class='psuedoColorRow'> Cutoff: &nbsp;
        <input id='falsecolor-interp2-cutlow' class='psval saveable psuedoCutoffLow'  type="text"  value='0' width='5'/>&nbsp; to &nbsp;
        <input id='falsecolor-interp2-cuthigh'class='psval saveable psuedoCutoffHigh'  type="text" value='0' width='5'/></span>&nbsp; ADC &nbsp;
      </div>
    </div>


</div> <!-- A-FalseColorControl -->
 <div class="wireimg-encoded-progressbar" style="position: relative; text-align:center;">
   <div class="wireimg-encoded-progressbar-text" style="position: absolute; color:black; width:100%"></div></div>
</div> <!-- portlet-content -->
</div> <!-- portlet -->


