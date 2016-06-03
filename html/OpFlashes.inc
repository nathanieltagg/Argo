    <div class="portlet" id="opflash-port"style="height:400px; display:flex; flex-direction: column;"> 
      <div class="portlet-header" style="flex: 0 0 auto;">Optical Flashes</div>
      <div class="portlet-content" style="flex: 1 1 0;   display:flex; flex-direction: column;">

          <div class="nonsqueezeable" style="min-height: 0; min-width:0; flex:1 1 0;  width:100%; display: flex; flex-direction: row; flex-wrap:nowrap; ">
            <!-- Flex 1 1 0 means equal width -->

            <div class="A-OpFlashHistogram" style="flex: 1 1 0; min-width:0;"></div>
            <div class="A-OpFlashMap"       style="flex: 1 1 0; min-width:0;"></div>
          </div>

          <div class="nonsqueezeable" style="min-height: 0; min-width:0; flex:2 2 0;  width:100%; display:flex; flex-direction: row; flex-wrap:nowrap;  ">
            <!-- Flex 4 4 0 and 1 1 0 means the first is four times wider than the second. -->
            <!-- min-width:0 means that internal content is ignored, so the canvas inside can be squished or whatever. -->
              
            <div class="A-OpFlash2dMap"          style="flex: 4 4 0; min-width:0;"></div>
            <div class="A-OpFlash2dMapProjection" style="flex: 1 1 0; min-width:0;" ></div>
          </div>
          
      </div> <!-- portlet-content -->
    </div> <!-- portlet -->

