    <div class="portlet" id="config-port"> 
      <div class="portlet-header">Configuration:</div>
      <div class="portlet-content">

        <select  id="ctl-color-scale" class="saveable">
			<option value="RedBluePalette" selected="selected">Red-Blue Palette</option>
			<option value="BrownPurplePalette">Brown-Purple Palette</option>
			<option value="GrayscalePalette">Grayscale</option>
			<option value="CurtPalette">Curt's Color Palette</option>
			<option value="PhilipColorPalette"  >Philip's Color Palette</option>
			
		</select><br/>
        <div><input type="checkbox" id="ctl-magnifying-glass"  class="saveable" name="ctl-magnifying-glass"   checked="yes" /><label for="ctl-magnifying-glass"  >Magnifying glass</label></div>
        <div id="mag-sliders">
          <div>
          <label for="ctl-magnifier-size">Mag. Size:</label>         
          <input id="ctl-magnifier-size" class="saveable" type="text" value="60" size="4" />
          </div>
          <div id="ctl-magnifier-size-slider"></div>
          <div>
          <label for="ctl-magnifier-mag">Magnification:</label>         
          <input id="ctl-magnifier-mag"  class="saveable" type="text" value="3" size="4" />          
          </div>
          <div id="ctl-magnifier-mag-slider"></div>
        </div>
        <div><input type="checkbox" id="ctl-hitmap-show-hits"   name="ctl-hitmap-show-hits"   checked="yes" class="saveable"/><label for="ctl-show-hitmap-hits">Show hits</label></div>
        <div><input type="checkbox" id="ctl-show-labels" name="ctl-show-labels" checked="yes" class="saveable"/><label for="ctl-show-labels">Draw Axis Labels</label></div>
        <div><input type="checkbox" id="ctl-show-tick-labels" name="ctl-show-tick-labels" checked="yes" class="saveable"/><label for="ctl-show-tick-labels">Draw Tick Values</label></div>

		<br/>
        <button class="ui-state-default ui-corner-all styled-button" id='ctl-save-config'>Save</button>        
        <button class="ui-state-default ui-corner-all styled-button" id='ctl-load-config'>Load</button>        
        <button class="ui-state-default ui-corner-all styled-button" id='ctl-restore-defaults'>Restore Defaults</button>
      </div>      
    </div> <!-- configuration portlet -->

