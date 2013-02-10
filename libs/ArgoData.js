//
// Functions to handle micrboone json data.
//

// Global bookmarks into data record.
gHits = [];

function DoInitialBookmarking()
{
  gHits = null;
  if(gRecord.hits) {
    if(gRecord.hits.hits) {
      gHits = gRecord.hits.hits;
    }
  }
}