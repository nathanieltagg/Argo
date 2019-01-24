#include "GalleryComposer.h"
#include "ComposerFactory.h"
#include <fstream>
#include "TSystem.h"

#include "ForkedComposer.h"

void progress(float frac, const std::string& str) {
  // std::string cmd = "osascript -e 'display notification \"" + str + "\" with title \"Progress "+std::to_string(frac) + "\"'";
  // system(cmd.c_str());
  std::cerr << "==== " << frac << " " << str<< std::endl;
}
int main(int argc, char **argv)
{
  using nlohmann::json;
  
  progress(0,"Starting up");
  Config_t config(new json(json::object()));
  Output_t final_result;

  (*config)["max_composers"] = 0;

  ComposerFactory factory;
  factory.configure(config);
  // ForkedComposer<GalleryComposer> fc;
  // fc.configure(config);
  // fc.initialize();

  Request_t request(new json(json::object()));
  
  (*request)["filename"] =
  "/Users/tagg/PhysicsRun-2016_5_10_15_21_12-0006234-00031_20160802T075516_ext_unbiased_20160802T110203_merged_20160802T121639_reco1_20160802T144807_reco2_20171030T150606_reco1_20171030T162925_reco2.root";
    // "/Users/tagg/Argo/Supernova_0016788_0307030_0313281.ubdaq";
    // "/Users/tagg/Argo/server/ana_hist_ceda4617-288a-4bd5-822d-a9207ce86188.root";
    // "/Users/tagg/Argo/server/larlite_pandoraCosmic.root";
  (*request)["entrystart"]   = 0;
  (*request)["entryend"]   = 5;
  (*request)["selection"]   = "1";
  (*request)["options"]   = "__NORAW__NOCAL__";


  for(int iter=0;iter<10;iter++){
    long t1 = gSystem->Now();
    
    // Result_t  result(new json(json::object()));
    // GalleryComposer* gc = new GalleryComposer();
    // gc->configure(config);
    // gc->initialize();
    // gc->satisfy_request(request,result);

    // Output_t result = factory.compose(request);

    Output_t result = factory.compose(request,&progress);

    long t2 = gSystem->Now();
    // reparse
    json data = json::parse(*result);
    std::cout << "XXXX  TIME TO RUN " << t2-t1 << std::endl;

    int composer_id = data.value("composer_id",0);
    if(composer_id) {
      (*request)["composer_id"] =composer_id;
    }
    if(data.value("composer_id",0) >0)

    final_result = result;
  }
  std::cout << "Result: " << final_result->size() << std::endl;
  std::ofstream ofs("test.json");
  ofs << *final_result;
  ofs.close();

  // reparse
  json data = json::parse(*final_result);
  std::cout << "Data sizes: " << std::endl;
  for(json::iterator it = data.begin(); it!=data.end(); it++ ) {
    std::string substr = it.value().dump();
    std::cout << Form("%20s %10lu %100s",it.key().c_str(),substr.size(),substr.substr(0,100).c_str()) << std::endl;
  }
}