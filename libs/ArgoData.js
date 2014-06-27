//
// Functions to handle micrboone json data.
//

// Global bookmarks into data record.
gCurObjNames = {
  raw: null,
  cal: null,
};
gHitsListName = null;
gMCParticlesListName = null;
gMCTruthListName = null;
gOpPulsesListName = null;

function DoInitialBookmarking()
{
  gCurName = {
    raw: null,
    cal: null,
  };
  gHitsListName = null;
  gOphitsListName=null;
  gOpflashesListName=null;
  gOpPulsesListName=null;
  gMCParticlesListName = null;
  gMCTruthListName = null;
  
  gSelectedTrack = null;
  
  var i;
  
  if(gRecord.raw) {
    for(i in gRecord.raw) { // element can be set to null; just key exists if not loaded.
      if(gRecord.raw[i] && gRecord.raw[i].wireimg_url) {gCurName.raw = i; break;}
    }
  }

  if(gRecord.cal) {
    for(i in gRecord.cal) { 
      if(gRecord.cal[i] && gRecord.cal[i].wireimg_url) {gCurName.cal =i; break;}
    }
  }


  $('#ctl-HitLists').empty();
  if(gRecord.hits) {
    for(i in gRecord.hits) { 
      $('#ctl-HitLists').append("<option value='"+i+"'>"+i.replace(/^[^_]*_/,"")+"</option>");
      if(gRecord.hits[i].length > 0) gHitsListName = i; // Select the first list that has nonzero entries.
    }
  }

  $('#ctl-ClusterLists').empty();
  if(gRecord.clusters) {
    for(i in gRecord.clusters) { 
      $('#ctl-ClusterLists').append("<option value='"+i+"'>"+i.replace(/^[^_]*_/,"")+"</option>");
    }
  }

  $('#ctl-EndpointLists').empty();
  if(gRecord.endpoint2d) {
    for(i in gRecord.endpoint2d) { 
      $('#ctl-EndpointLists').append("<option value='"+i+"'>"+i.replace(/^[^_]*_/,"")+"</option>");
    }
  }


  $('#ctl-SpacepointLists').empty();
  for(i in gRecord.spacepoints) { 
    // Sanitize name a little: remove everything before and including first underscore.
    $('#ctl-SpacepointLists').append("<option value='"+i+"'>"+i.replace(/^[^_]*_/,"")+"</option>");
  }

  $('#ctl-TrackLists').empty();
  for(i in gRecord.tracks) { 
    $('#ctl-TrackLists').append("<option value='"+i+"'>"+i.replace(/^[^_]*_/,"")+"</option>");
  }
  
  if(gRecord.oppulses) {
    for(i in gRecord.oppulses) { 
      gOpPulsesListName = i;
      if(gRecord.oppulses[i].length > 0) break; // Select the first list that has nonzero entries.
    }
  }

  if(gRecord.ophits) {
    for(i in gRecord.ophits) { 
      gOphitsListName = i;
      if(gRecord.ophits[i].length > 0) break; // Select the first list that has nonzero entries.
    }
  }

  if(gRecord.opflashes) {
    for(i in gRecord.opflashes) { 
      gOpflashesListName = i;
      if(gRecord.opflashes[i].length > 0) break; // Select the first list that has nonzero entries.
    }
  }

  if(gRecord.mc) {
    if(gRecord.mc.gtruth) {
      for(i in gRecord.mc.gtruth) { 
        gMCTruthListName = i;
        if(gRecord.mc.gtruth[i].length > 0) break; // Select the first list that has nonzero entries.
      }
    }

    if(gRecord.mc.particles) {
      for(i in gRecord.mc.particles) { 
        gMCParticlesListName = i;
        if(gRecord.mc.particles[i].length > 0) break; // Select the first list that has nonzero entries.
      }
    }
    
  }

}