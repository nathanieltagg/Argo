#ifndef ARGOGEODUMPER_CLASSES_H_CCAEF25B
#define ARGOGEODUMPER_CLASSES_H_CCAEF25B

#include <TVector3.h>

namespace agd {

  class wire_info {
  public:
    int    section;
    int    cid;
    int    cryo;
    int    tpc;
    int    plane;
    int    larsoft_view;
    int    view;
    int    wire; 
    double tpcface[3]; // xyz of front face
    double tpctrans[3]; // above dotted with tran vectors ea,eb,ez
    double tpchalfwidth[3];

    double pitch;
    double wiredir[3];
    double transdir[3];
    double wirecenter[3];
    double end1[3];
    double end2[3];
    double trans;
    double along;
    double halflength;
  };

}


#endif /* end of include guard: SNHITCOMPARE_CLASSES_H_B14333B0 */
