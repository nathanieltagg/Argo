#ifndef ROOTTOJSON_H_1VW0NCQF
#define ROOTTOJSON_H_1VW0NCQF

#include "JsonElement.h"

// Tools to convert ROOT objects to JSON objects.


class TH1;
class TH2;

JsonObject TH1ToHistogram( TH1* hist );
JsonObject TH2ToHistogram( TH2* hist );



#endif /* end of include guard: ROOTTOJSON_H_1VW0NCQF */
