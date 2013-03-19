//
// Functions to handle micrboone json data.
//

// Global bookmarks into data record.
gHits = [];
gTracks = [];

gSelectedTrack = null;

function DoInitialBookmarking()
{
  gHits = null;
  if(gRecord.hits) {
    if(gRecord.hits.hits) {
      gHits = gRecord.hits.hits;
    }
  }
  gTracks = null;
  if(gRecord.tracks) gTracks=gRecord.tracks;
}