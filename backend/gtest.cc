#include "GalleryComposer.h"
#include "ComposerFactory.h"
#include "TROOT.h"
#include <fstream>
#include "TH1.h"


int main(int argc, char **argv)
{
  using nlohmann::json;
  
  Config_t config(new json(json::object()));
  Result_t final_result;

  ComposerFactory factory(config);

  std::shared_ptr<std::string> s(new std::string);
  for(int iter=0;iter<1;iter++){

    Request_t request(new json(json::object()));
    
    (*request)["filename"] =
    //"/Users/tagg/PhysicsRun-2016_5_10_15_21_12-0006234-00031_20160802T075516_ext_unbiased_20160802T110203_merged_20160802T121639_reco1_20160802T144807_reco2_20171030T150606_reco1_20171030T162925_reco2.root";
      // "/Users/tagg/Argo/Supernova_0016788_0307030_0313281.ubdaq";
      // "/Users/tagg/Argo/server/ana_hist_ceda4617-288a-4bd5-822d-a9207ce86188.root";
      "/Users/tagg/Argo/server/larlite_pandoraCosmic.root";
    (*request)["entrystart"]   = 0;
    (*request)["entryend"]   = 5;
    (*request)["selection"]   = "1";
    (*request)["options"]   = "__NORAW__NOCAL__";
    
    // Result_t  result(new json(json::object()));
    // GalleryComposer* gc = new GalleryComposer();
    // gc->configure(config);
    // gc->initialize();
    // gc->satisfy_request(request,result);

    Request_t result = factory.compose(request);

    final_result = result;
    *s = result->dump();

  }
  std::cout << "Result: " << s->size() << std::endl;
  std::ofstream ofs("test.json");
  ofs << *s;
  ofs.close();

  std::cout << "Data sizes: " << std::endl;
  for(json::iterator it = final_result->begin(); it!=final_result->end(); it++ ) {
    std::string substr = it.value().dump();
    std::cout << Form("%20s %10lu %100s",it.key().c_str(),substr.size(),substr.substr(0,100).c_str()) << std::endl;
  }
}