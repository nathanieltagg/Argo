//
// Functions to handle micrboone json data.
//

// Global bookmarks into data record.
gHits = [];
gTracks = [];

gSelectedTrack = null;

function DoInitialBookmarking()
{
  gHits = [];
  if(gRecord.hits) {
    if(gRecord.hits.hits) {
      gHits = gRecord.hits.hits;
    }
  }
  gTracks = [];
  if(gRecord.tracks) gTracks=gRecord.tracks;
}