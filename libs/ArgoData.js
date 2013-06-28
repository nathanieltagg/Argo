//
// Functions to handle micrboone json data.
//

// Global bookmarks into data record.
gCurObjNames = {
  raw: null,
  cal: null,
};
gHitsListName = null;
gClustersListName = null;
gSpacepointsListName = null;
gTracksListName = null;
gMCParticlesListName = null;
gMCTruthListName = null;
gSelectedTrack = null;

function DoInitialBookmarking()
{
  gCurName = {
    raw: null,
    cal: null,
  };
  gHitsListName = null;
  gClustersListName = null;
  gSpacepointsListName = null;
  gTracksListName = null;
  gOphitsListName=null;
  gOpflashesListName=null;
  
  gMCParticlesListName = null;
  gMCTruthListName = null;
  
  gSelectedTrack = null;
  
  
  
  if(gRecord.raw) {
    for(var i in gRecord.raw) { 
      if(gRecord.raw[i].wireimg_url) {gCurName.raw = i; break;}
    }
  }

  if(gRecord.cal) {
    for(var i in gRecord.cal) { 
      if(gRecord.cal[i].wireimg_url) {gCurName.cal =i; break;}
    }
  }


  if(gRecord.hits) {
    for(var i in gRecord.hits) { 
      gHitsListName = i;
      if(gRecord.hits[i].length > 0) break; // Select the first list that has nonzero entries.
    }
  }

  if(gRecord.clusters) {
    for(var i in gRecord.clusters) { 
      gClustersListName = i;
      if(gRecord.clusters[i].length > 0) break; // Select the first list that has nonzero entries.
    }
  }

  if(gRecord.spacepoints) {
    for(var i in gRecord.spacepoints) { 
      gSpacepointsListName = i;
      if(gRecord.spacepoints[i].length > 0) break; // Select the first list that has nonzero entries.
    }
  }

  if(gRecord.tracks) {
    for(var i in gRecord.tracks) { 
      gTracksListName = i;
      if(gRecord.tracks[i].length > 0) break; // Select the first list that has nonzero entries.
    }
  }

  if(gRecord.ophits) {
    for(var i in gRecord.ophits) { 
      gOphitsListName = i;
      if(gRecord.ophits[i].length > 0) break; // Select the first list that has nonzero entries.
    }
  }

  if(gRecord.opflashes) {
    for(var i in gRecord.opflashes) { 
      gOpflashesListName = i;
      if(gRecord.opflashes[i].length > 0) break; // Select the first list that has nonzero entries.
    }
  }

  if(gRecord.mc) {
    if(gRecord.mc.gtruth) {
      for(var i in gRecord.mc.gtruth) { 
        gMCTruthListName = i;
        if(gRecord.mc.gtruth[i].length > 0) break; // Select the first list that has nonzero entries.
      }
    }

    if(gRecord.mc.particles) {
      for(var i in gRecord.mc.particles) { 
        gMCParticlesListName = i;
        if(gRecord.mc.particles[i].length > 0) break; // Select the first list that has nonzero entries.
      }
    }
    
  }

}