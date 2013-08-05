<div class="portlet" id="ArgoDreamyScan-portlet">
    <div class="portlet-header">Scan</div>
    <div class="portlet-content">
      <div class="A-ArgoDreamyScan">


        <div class="dreamy-login-form" style='display:none'>
          <!-- this div usually hidden -->
          <p><label>User Name:</label><br/><input type="text" class="ui-state-default dreamy-username-input" value="Anonymous Coward" /> </p>
        </div>
        
        <div>
          <input class="ui-state-default ui-corner-all dreamy-change-username-button" type="button" value="Change Login" />            
            Logged in as: <span class='dreamy-username'>Error!</span>
        </div>





        <form class="dreamy-scan-form">
        
        <!-- start form -->
        
        <span class="scan-input">Flags for  Events:</span><br />
        <input type="checkbox" name="checkEcal"       value="1"><span>ECAL event</span><br>
        <input type="checkbox" name="checkRock"       value="1"><span>Rock-muon</span><br>
        <input type="checkbox" name="checkProblem"    value="1"><span>Detector problem</span><br>
        <input type="checkbox" name="checkCant"       value="1"><span>Unanalyzable</span><br>
        <input type="checkbox" name="checkNukeTarget" value="1"><span>Nuclear Target Hit</span><br>
  
       <select name="VertexHits"><option>0</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option><option>10</option></select>
       <span>Vertex Activity</span>
       <select name="ShowerProngs"><option>0</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option><option>10</option></select>
       <span>Shower Prongs</span>
       <select name="TrackProngs"><option>0</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option><option>10</option></select>
       <span>Track Prongs</span>
       <div>
         <span>Prong 1:</span>
           <span><input type="radio" name="Prong1" value="0" checked="checked"/>N/A</span>&nbsp;
           <span><input type="radio" name="Prong1" value="1"/>Exit rear</span>&nbsp;
           <span><input type="radio" name="Prong1" value="2"/>Exit side</span>&nbsp;
           <span><input type="radio" name="Prong1" value="3"/>Scatter</span>&nbsp;
           <span><input type="radio" name="Prong1" value="4"/>Shower</span>&nbsp;
           <span><input type="radio" name="Prong1" value="5"/>Range-stop</span>&nbsp;
        </div>

     <div>
     <span class="scan-input">Prong 2:</span>
       <span><input type="radio" name="Prong2" value="0" checked="checked"/>N/A</span>&nbsp;
       <span><input type="radio" name="Prong2" value="Exit HCAL rear"/>Exit  rear</span>&nbsp;
       <span><input type="radio" name="Prong2" value="2"/>Exit  side</span>&nbsp;
       <span><input type="radio" name="Prong2" value="3"/>Scatter</span>&nbsp;
       <span><input type="radio" name="Prong2" value="4"/>Shower</span>&nbsp;
       <span><input type="radio" name="Prong2" value="5"/>Range-stop</span>&nbsp;
     </div>

     <div>
     <span class="scan-input">Prong 3:</span>
       <span><input type="radio" name="Prong3" value="0" checked="checked"/>N/A</span>&nbsp;
       <span><input type="radio" name="Prong3" value="1"/>Exit rear</span>&nbsp;
       <span><input type="radio" name="Prong3" value="2"/>Exit side</span>&nbsp;
       <span><input type="radio" name="Prong3" value="3"/>Scatter</span>&nbsp;
       <span><input type="radio" name="Prong3" value="4"/>Shower</span>&nbsp;
       <span><input type="radio" name="Prong3" value="5"/>Range-stop</span>&nbsp;
     </div>


     <select name="GammaConversions"><option>0</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option><option>10</option></select>
     <span class="scan-input scan-input-label">Gammas</span>
     <select name="VeeVertices"><option>0</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option><option>10</option></select>
     <span class="scan-input scan-input-label">K<sup>0</sup>/&Lambda; decays</span>
     <select name="neutrons"><option>0</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option><option>10</option></select>
     <span class="scan-input scan-input-label">Neutrons</span>
     <br/>
     <span class="scan-input scan-input-label">Notes:</span>
     <textarea style="width: 70%" name="notes"></textarea>
        
        <!-- end form -->
        </form>
        <span class="dreamy-scan-form-submit-button">Submit</span>
        <span class="dreamy-scan-form-submit-and-advance-button">Submit-And-Advance</span>

        <div class="dreamy-scan-results"></div>

        <div class="dreamy-inbox"></div>

        <div class="dreamy-eventlist"></div>
      </div>
    </div> <!-- slice-info -->
  </div>
