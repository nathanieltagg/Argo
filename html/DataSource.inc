<div class="portlet" id="source-port"> 
	<div class="portlet-header">Data Source</div>
<div id="input-fe">
    <a style="font-size: large;" href="server/file_browser.cgi">File Browser</a>
    <form id="fileform"  action="" > 
      <label class='tbfill'>Filename:</label>
      <span><input type="text" class="ui-state-default tbfill"  id="inFilename" name="inFilename" value="standard_reco_uboone.root"/></span>
      <label>Cut:  </label><input style="width:200px" class="inSelection ui-state-default" type="text" id="inFeSelection" name="inFeSelection" value="1"/>
      &nbsp;&nbsp;&nbsp; <label>Entry:  </label><input class="inEntry ui-state-default" type="text" size="5" id="inFeEntry" name="inFeEntry" value="1"/>
      <input class="ui-state-default ui-corner-all" type="button" id="go_fe" value="Go!" /> <br/>
     </form> 
     <input type="button" class='next-event ui-state-default ui-corner-all' value='Next Event'/>
     <input type="button" class='prev-event ui-state-default ui-corner-all' value='Prev Event'/>
     
</div>
</div>  <!-- portlet -->
