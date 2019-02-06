<div class="portlet" id="source-port"> 
	<div class="portlet-header">Data Source</div>
  <div class="portlet-content" id='data-source-tabs'>  
	<ul>
    <li><a href="#input-fe">Data File</a></li>
    <li><a href="#input-rawrun">Find Event By Run Number</a></li>
    <!-- <li><a href="#input-larlight">LarLight File</a></li> -->
    <!-- <li><a href="#input-json">JSON Upload</a></li> -->
	</ul>


<div id="input-fe">
    <a href="server/file_browser.cgi">File Browser</a>
    <form id="fileform" > 
      <label class='tbfill'>Filename:</label>
      <span><input type="text" class="ui-state-default tbfill"  id="inFilename" name="inFilename" value="standard_reco_uboone.root"/></span>
      <span style='display:none;'><label>Cut:  </label><input style="width:200px" class="inSelection ui-state-default" type="text" id="inFeSelection" name="inFeSelection" value="1"/></span>
      &nbsp;&nbsp;&nbsp;
      <select id="inEntryOrEvent">
        <option value="Entry">Entry</option>
        <option value="Event">Event</option>
      </select>
       <input class="ui-state-default" type="text" size="5" id="inFeEntry" name="inFeEntry" value="0"/>
       <input class="ui-state-default ui-corner-all" type="button" id="go_fe" value="Go!" /> <br/>
     </form> 
     
     <button class='next-event ui-state-default ui-corner-all styled-button'>(N)ext Event</button>
     <button class='prev-event ui-state-default ui-corner-all styled-button'>(P)rev Event</button>
     
</div>

<div id="input-rawrun">
    <form id="fileform-rawrun" > 
      <h3> Data found by samweb: </h3>
        <label class='tbfill'>Run:</label>
          <span><input type="text" class="ui-state-default tbfill inRun saveable"  id="inRawRun" name="inRawRun" value=""/></span>
        <label class='tbfill'>Event:</label><input class="inEvent ui-state-default saveable" type="text" size="5" id="inRawEvent" name="inRunEntry" value="0"/>

        <select id="inRawTier" name="inRawTier" class="saveable">
          <option value='raw'                >raw (swizzled)       </option>
          <option value='crt_swizzled'       >crt_swizzled         </option>
          <option value='larlite'            >larlite              </option>
          <option value='recolite'           >recolite             </option>
          <option value='reconstructed'      >reconstructed        </option>
          <option value='root-tuple'         >root-tuple           </option>
          <option value='generated'          >generated            </option>
          <option value='simulated'          >simulated            </option>
          <option value='detector-simulated' >detector-simulated   </option>
          <option value='reconstructed-2d'   >reconstructed-2d     </option>
          <option value='reconstructed-3d'   >reconstructed-3d     </option>
          <option value='optical-simulated'  >optical-simulated    </option>
          <option value='tpc-simulated'      >tpc-simulated        </option>
          <option value='overlaid'           >overlaid             </option>
          <option value='larcv'              >larcv                </option>
          <option value='larcv_wholeview'    >larcv_wholeview      </option>
          <option value='larlite_opreco'     >larlite_opreco       </option>
          <option value='larlite_reco2d'     >larlite_reco2d       </option>
          <option value='larlite_mcinfo'     >larlite_mcinfo       </option>
          <option value='larcv_mctruth'      >larcv_mctruth        </option>
          <option value='crt'                >crt                  </option>
          <option value='larcv_pandora'      >larcv_pandora        </option>
          <option value='larlite_pandora'    >larlite_pandora      </option>
          <option value='larlite_backtracker'>larlite_backtracker  </option>
          <option value='pandora'            >pandora              </option>
          <option value='pandora_debug'      >pandora_debug        </option>
          <option value='celltree'           >celltree             </option>        
        </select>
        
        <select id="inRawTrig" name="inRawTrig" class="saveable">
          <!--These are the file types known to have data. Found with samweb list-values, then list-files . Not all are in 'swizzle' stream though -->
         <option value='outextunbiased'   >extunbiased   </option>  
         <option value="" disabled="disabled">─────────</option>

         <option value='outextbnb'        >extbnb        </option>
         <option value='outbnbunbiased'   >bnbunbiased   </option>
         <option value='outbnb'           >bnb           </option>
          <option value="" disabled="disabled">────────</option>

         <option value='outextnumi'       >extnumi       </option>
         <option value='outnumiunbiased'  >numiunbiased  </option>   
         <option value='outnumi'          >numi          </option>
         <option value="" disabled="disabled">─────────</option>
         
         <!-- <option value='rawnotpc'         >rawnotpc      </option> -->
         <option value='outmucs'          >mucs          </option>
         <option value='outnotpc'         >notpc         </option>
      <input class="ui-state-default ui-corner-all" type="button" id="go_rawrun" value="Go!" /> <br/>
     </form> 
     
     <button class='next-event ui-state-default ui-corner-all styled-button'>(N)ext Event</button>
     <button class='prev-event ui-state-default ui-corner-all styled-button'>(P)rev Event</button>
     
</div>

<!-- <div id='input-json'>
         <p>This works only with .json files created by larlight or downloaded from Argo.</p>
         <input type="file" id="inLocalFile" name="inLocalFile" />
         <input class="ui-state-default ui-corner-all" type="button" id="go_localfile" value="Reload" /> <br/>
</div> -->

</div>  <!-- portlet-content -->
</div>  <!-- portlet -->
