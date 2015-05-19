<div class="portlet" id="source-port"> 
	<div class="portlet-header">Data Source</div>
  <div class="portlet-content" id='data-source-tabs'>  
	<ul>
    <li><a href="#input-fe">LArSoft File OR Raw ubdaq File</a></li>
    <!-- <li><a href="#input-larlight">LarLight File</a></li> -->
    <li><a href="#input-json">JSON Upload</a></li>
	</ul>


<div id="input-fe">
    <a style="font-size: large;" href="server/file_browser.cgi">File Browser</a>
    <form id="fileform" > 
      <label class='tbfill'>Filename:</label>
      <span><input type="text" class="ui-state-default tbfill"  id="inFilename" name="inFilename" value="standard_reco_uboone.root"/></span>
      <label>Cut:  </label><input style="width:200px" class="inSelection ui-state-default" type="text" id="inFeSelection" name="inFeSelection" value="1"/>
      &nbsp;&nbsp;&nbsp; <label>Entry:  </label><input class="inEntry ui-state-default" type="text" size="5" id="inFeEntry" name="inFeEntry" value="0"/>
      <input class="ui-state-default ui-corner-all" type="button" id="go_fe" value="Go!" /> <br/>
     </form> 
     
     <button class='next-event ui-state-default ui-corner-all styled-button'>(N)ext Event</button>
     <button class='prev-event ui-state-default ui-corner-all styled-button'>(P)rev Event</button>
     
</div>

<div id='input-json'>
         <p>This works only with .json files created by larlight or downloaded from Argo.</p>
         <input type="file" id="inLocalFile" name="inLocalFile" />
         <input class="ui-state-default ui-corner-all" type="button" id="go_localfile" value="Reload" /> <br/>
</div>

</div>  <!-- portlet-content -->
</div>  <!-- portlet -->
