#ifndef COHERENTNOISEFILTER_H_54935DB5
#define COHERENTNOISEFILTER_H_54935DB5


#include "EncodedTileMaker.h"

void CoherentNoiseFilter(
  std::shared_ptr<wiremap_t> wireMap, 
  std::shared_ptr<wiremap_t> noiseWireMap,                         
  size_t nwires,
  size_t ntdc
);




#endif /* end of include guard: COHERENTNOISEFILTER_H_54935DB5 */
