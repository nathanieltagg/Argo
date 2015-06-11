    <div class="portlet" id="config-port"> 
      <div class="portlet-header">Configuration:</div>
      <div class="portlet-content">
        <!-- <form id="controls" action=""> -->

        <select  id="ctl-hit-color-scale" class="saveable">
			<option value="RedBluePalette" selected="selected">Red-Blue Palette</option>
			<option value="BrownPurplePalette">Brown-Purple Palette</option>
			<option value="GrayscalePalette">Grayscale</option>
			<option value="CurtPalette">Curt's Color Palette</option>
			<option value="PhilipColorPalette"  >Philip's Color Palette</option>
			
		</select><br/>
        <div><input type="checkbox" id="ctl-magnifying-glass"  class="saveable" name="ctl-magnifying-glass"   checked="checked" /><label for="ctl-magnifying-glass"  ><b>(g)</b> Magnifying glass</label></div>
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
        <div><input type="checkbox" id="ctl-histo-logscale" name="ctl-histo-logscale" checked="checked" class="saveable  ctl-histo-logscale"/><label for="ctl-histo-logscale"><b>(l)</b>og-scale Histograms</label></div>
        <div><input type="checkbox" id="ctl-show-labels" name="ctl-show-labels" checked="checked" class="saveable"/><label for="ctl-show-labels">Draw Axis Labels</label></div>
        <div><input type="checkbox" id="ctl-show-tick-labels" name="ctl-show-tick-labels" checked="checked" class="saveable"/><label for="ctl-show-tick-labels">Draw Tick Values</label></div>
        <div><input type="checkbox" id="ctl-lock-aspect-ratio" name="ctl-lock-aspect-ratio"             class="saveable"/><label for="ctl-lock-aspect-ratio">Lock TDC/Wire aspect ratio</label></div>
        <div><input type="checkbox" id="ctl-show-wireimg" name="show-wireimg" class="saveable show-wireimg" /><label for="ctl-show-wireimg"><b>(w)</b> Show Wire data</label></div>
        <div><b>(Shift-W)</b>
          <span class="align-right">
          <input type="radio" id="ctl-show-wireimg-raw" value="raw" name="show-wireimg-type" class="saveable show-wireimg-raw"         /><label for="ctl-show-wireimg-raw">Raw</label>
          <input type="radio" id="ctl-show-wireimg-cal" value="cal" name="show-wireimg-type" class="saveable show-wireimg-cal" checked />     <label for="ctl-show-wireimg-cal">Calibrated</label>
          </span>
          <div style="clear:both;"></div>
          </div>
        
        <div><input type="checkbox" id="ctl-show-hits"    name="show-hits"    class="saveable show-hits"    checked="checked"/><label for="ctl-show-hits">    <b>(h)</b> Show Hits </label></div>
          <div><b>(shift-H)</b> <select id="ctl-HitLists"  class="align-right"></select><div style="clear:both;"></div></div>
          
        <div><input type="checkbox" id="ctl-show-clus"    name="show-clus"    class="saveable show-clus"                 /><label for="ctl-show-clus">    <b>(c)</b> Show Clusters </label></div>
        <div><b>(shift-C)</b> <select id="ctl-ClusterLists"  class="align-right"></select><div style="clear:both;"></div></div>


        <div><input type="checkbox" id="ctl-show-endpoint2d"    name="show-endpoint2d"    class="saveable show-endpoint2d"                 /><label for="ctl-show-endpoint2d"> <b>(e)</b>  Show Endpoint2Ds </label></div>
        <div> <b>(shift-E)</b><select id="ctl-EndpointLists"  class="align-right"></select><div style="clear:both;"></div></div>
        
        <div><input type="checkbox" id="ctl-show-spoints" name="show-spoints" class="saveable show-spoints"              /><label for="ctl-show-spoints"> <b></b> Show Spacepoints </label></div>
        <div> <select id="ctl-SpacepointLists"  class="align-right"></select><div style="clear:both;"></div></div>

        <div><input type="checkbox" id="ctl-show-tracks"  name="show-tracks"  class="saveable show-tracks"  checked="checked"/><label for="ctl-show-tracks">  <b>(t)</b> Show Tracks </label></div>
        <div><b>(shift-T)</b> <select id="ctl-TrackLists"  class="align-right"></select><div style="clear:both;"></div></div>
        <div>&nbsp;&nbsp;<input type="checkbox" id="ctl-track-shift-window"      name="track-shift-window"   checked="checked"   class="saveable track-shift-window"  /><label for="track-shift-window">      <b>(o)</b> Shift Tracks 1 Window</label></div>

        <div><input type="checkbox" id="ctl-show-showers"  name="show-showers"  class="saveable show-showers"  checked="checked"/><label for="ctl-show-showers">  <b>(s)</b> Show Showers </label></div>
        <div><b>(shift-S)</b> <select id="ctl-ShowerLists"  class="align-right"></select><div style="clear:both;"></div></div>


        <div><label><input type="checkbox" id="ctl-show-pfparticles"  name="show-pfparticles"  class="saveable show-pfparticles"  checked="checked"/><b>(f)</b> Show PFParticles </label></input></div>
        <div><b>(shift-F)</b> <select id="ctl-PFParticleLists"  class="align-right"></select><div style="clear:both;"></div></div>
            
        <div><input type="checkbox" id="ctl-show-mc"      name="show-mc"      class="saveable show-mc"      checked="checked"/><label for="ctl-show-mc">      <b>(m)</b> Show MC </label></div>
        <div>&nbsp;&nbsp;<input type="checkbox" id="ctl-show-mc-neutrals"      name="show-mc-neutrals"      class="saveable show-mc-neutrals"  /><label for="ctl-show-mc">      <b>(M)</b> Show neutral particles </label></div>
        <div>&nbsp;&nbsp;<input type="checkbox" id="ctl-mc-move-tzero"      name="ctl-mc-move-tzero"      class="saveable ctl-mc-move-tzero"  /><label for="ctl-mc-move-tzero">      <b>(z)</b> Fake t-zero </label></div>
          <!-- <div class="align-right"><div id="ctl-MCLists"></div><div style="clear:both;"></div></div> -->

		<br/>
        <button id='ctl-save-config'>Save</button>        
        <button id='ctl-load-config'>Load</button>        
        <button id='ctl-restore-defaults'>Restore Defaults</button>
        <!-- </form> -->
      </div>      
    </div> <!-- configuration portlet -->

