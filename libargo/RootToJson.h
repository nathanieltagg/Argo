#ifndef ROOTTOJSON_H_1VW0NCQF
#define ROOTTOJSON_H_1VW0NCQF

#include "json.hpp"

// Tools to convert ROOT objects to JSON objects.


class TH1;
class TH2;

nlohmann::json TH1ToHistogram( TH1* hist, int maxbins = 0 );
nlohmann::json TH2ToHistogram( TH2* hist, int maxbins = 0 );



#endif /* end of include guard: ROOTTOJSON_H_1VW0NCQF */
