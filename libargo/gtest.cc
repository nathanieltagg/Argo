#include "UniversalComposer.h"
#include <fstream>
#include "TSystem.h"
#include "TTimeStamp.h"

#include "TROOT.h"

#include <boost/thread.hpp>

void progress(Composer::OutputType_t type, Output_t out) {
  std::cerr << "==== " << type << " " << *out << std::endl;
}
  
  // "/home/argo/test_files/67898b88-38e2-473e-9fb3-d16110e067fd-prodgenie_bnb_nu_cosmic_uboone_33_20170420T163941_gen0_e6094051-a5dc-4793-a395-1ea0de9bbe98_20170421T022943_g4_sp_48488e28-8bef-4c64-8af8-d559ca856622.root";
//"/home/argo/test_files/PhysicsRun-2015_10_21_1_25_15-0003469-01047_20161123T115249_bnb_20161123T153248_merged.root";
    // "/Users/tagg/Argo/Supernova_0016788_0307030_0313281.ubdaq";
    // "/Users/tagg/Argo/server/ana_hist_ceda4617-288a-4bd5-822d-a9207ce86188.root";
    // "/Users/tagg/Argo/server/larlite_pandoraCosmic.root";

void do_dummy()
{
  double start = double(TTimeStamp());
  unsigned int i=0;
  double now = 0;
  do {
    i=i+1;
    now = TTimeStamp();
  } while(now-start < 30.);
  std::cout << "dummy done" << std::endl;
}

void do_one(Composer* c, Request_t req, Output_t& out)
{
  std::cout << "XXXXXXXXXXXXXXXXXXXXXXXXX--START--XXXXXXXXX" << req->value("req","") << std::endl;
  out = c->satisfy_request(req);
}

int main(int argc, char **argv)
{
  using ntagg::json;
  
  Config_t config(new json(json::object()));


  // (*config)["forking"] = true;

  Request_t request1(new json(json::object()));
  
  (*request1)["req"] = "REQUEST 1";
  (*request1)["filename"] =
    "/Users/tagg/PhysicsRun-2016_5_10_15_21_12-0006234-00031_20160802T075516_ext_unbiased_20160802T110203_merged_20160802T121639_reco1_20160802T144807_reco2_20171030T150606_reco1_20171030T162925_reco2.root";
  (*request1)["entrystart"]   = 0;
  (*request1)["entryend"]   = 5;
  (*request1)["selection"]   = "EventAuxiliary.id_.event_==1552";
  (*request1)["options"]   = "__NORAW__NOCAL__";
  Request_t request2(new json(json::object()));
  (*request2)["req"] = "REQUEST 2";
  (*request2)["filename"] =
    "/Users/tagg/PhysicsRun-2016_5_10_15_21_12-0006234-00031_20160802T075516_ext_unbiased_20160802T110203_merged_20160802T121639_reco1_20160802T144807_reco2_20171030T150606_reco1_20171030T162925_reco2.root";
  (*request2)["entrystart"]   = 2;
  (*request2)["entryend"]   = 5;
  (*request2)["selection"]   = "1";
  (*request2)["options"]   = "__NORAW__NOCAL__";

  Composer* composer1 = new UniversalComposer;
  composer1->configure(config);
  composer1->set_output_callback(&progress);
  // Composer* composer2 = new UniversalComposer;
  // composer2->configure(config);
  // composer2->set_output_callback(&progress);
  Output_t result1;
  // Output_t result2;

  // ROOT::EnableThreadSafety ();  std::cout << "EnableThreadSafety initialized" << std::endl;      // This actually makes it FAIL big time!
  // std::cout << "XXX Main thread it 1" << std::endl;
  // do_one(composer1,request1,result1);
  // std::cout << "XXX Main thread it 2" << std::endl;
  // do_one(composer1,request1,result1);

  {
    boost::thread t1{boost::bind(do_one,composer1,request1,std::ref(result1))};
    // sleep(1); std::cout << "mississipi" << std::endl;
    // std::cout << "Launching thread 2" << std::endl;
    // boost::thread t2{boost::bind(do_one,composer2,request2,std::ref(result2))};
    // boost::thread tdummy(do_dummy);
    // do_dummy();



    // tdummy.join();
    t1.join();
    // t2.join();
  }
  Output_t result = result1;
  
  std::cout << "Result: " << result->size() << std::endl;
  std::ofstream ofs("test.json");
  ofs << *result;
  ofs.close();

  json data = json::parse(*result);
  std::cout << "Data sizes: " << std::endl;
  for(json::iterator it = data.begin(); it!=data.end(); it++ ) {
    std::string substr = it.value().dump();
    std::cout << Form("%20s %10lu %100s",it.key().c_str(),substr.size(),substr.substr(0,100).c_str()) << std::endl;
  }
}
