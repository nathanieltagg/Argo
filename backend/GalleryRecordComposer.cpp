//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

#include <TTree.h>
#include <TLeaf.h>
#include <TFile.h>
#include <TROOT.h>
#include <TH1F.h>
#include <TH1D.h>
#include <TLorentzVector.h>
#include <TTreeFormula.h>
#include "TBranchElement.h"
#include "TStreamerInfo.h"
#include "Timer.h"
#include "TVirtualCollectionProxy.h"

#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
#include <algorithm>
#include <time.h>
#include <math.h>
#include <stdio.h>
#include <TTreeFormula.h>


#include "GalleryRecordComposer.h"
#include "JsonElement.h"
#include "TimeReporter.h"

#include "canvas/Utilities/TypeID.h"
#include "canvas/Persistency/Common/Assns.h"
#include "canvas/Persistency/Provenance/rootNames.h"
#include "gallery/Event.h"
#include "gallery/BranchMapReader.h"
#include "gallery/DataGetterHelper.h"
#include <TTree.h>
#include <TLeaf.h>

// Data objects
#include "canvas/Persistency/Provenance/EventAuxiliary.h"
#include "lardataobj/RawData/TriggerData.h"
#include "uboone/RawData/utils/ubdaqSoftwareTriggerData.h"
#include "lardataobj/RecoBase/Wire.h"
#include "lardataobj/RawData/RawDigit.h"
#include "lardataobj/RecoBase/Hit.h"
#include "lardataobj/RecoBase/Cluster.h"
#include "lardataobj/RecoBase/Track.h"
#include "lardataobj/RecoBase/Seed.h"
#include "lardataobj/RecoBase/Shower.h"
#include "lardataobj/RecoBase/Vertex.h"
#include "lardataobj/RecoBase/EndPoint2D.h"
#include "lardataobj/RecoBase/SpacePoint.h"
#include "lardataobj/RecoBase/PFParticle.h"
#include "lardataobj/RecoBase/OpHit.h"
#include "lardataobj/RecoBase/OpFlash.h"
#include "nusimdata/SimulationBase/GTruth.h"
#include "nusimdata/SimulationBase/MCTruth.h"
#include "nusimdata/SimulationBase/MCFlux.h"

#include "MakePng.h"
#include "EncodedTileMaker.h"
#include "RootToJson.h"
#include "GetSloMonDB.h"
#include "wireOfChannel.h"
#include "waveform_tools.h"

#include <stdlib.h>

#include "boost/thread/thread.hpp"
#include "boost/thread/mutex.hpp"
#include "boost/thread/shared_mutex.hpp"
#include "boost/core/demangle.hpp"

#include "DeadChannelMap.h"
#include "CoherentNoiseFilter.h"




using namespace std;



GalleryRecordComposer::GalleryRecordComposer(JsonObject& output, std::string filename, Long64_t jentry, const std::string options)
  : fOutput(output), fEntry(jentry), fOptions(options), fEvent(new gallery::Event({filename}))
{
  fCacheStoragePath     = "../live_event_cache";
  fCacheStorageUrl      = "live_event_cache";
  fWorkingSuffix = "working";
  fFinalSuffix   = "event";
  fCreateSubdirCache = true;  
}
  
GalleryRecordComposer::~GalleryRecordComposer()
{
}



template<typename T>
vector<std::pair<string,art::InputTag>>  findByType(TTree* fTree)
{
  vector<std::pair<string,art::InputTag>> retval;
  // Leaf names for std::vector<recob::Wire> get renamed
  // to the art version of "recob::Wires" by this. 
  std::string pattern = art::TypeID(typeid(T)).friendlyClassName();
  std::cout << "Looking for leaf of type " << pattern << "_label_instance_process." << endl;
  TObjArray* list = fTree->GetListOfBranches();

  // Look through every branch name.
  
  // We're looking for:
  // OBJ_LABEL_INSTANCE_PROCESSNAME.obj_
  // Where OBJ is something like "recob::Wires"
  // Where LABEL is something like "pandora"
  // INSTANCE is usually (always?) blank
  // Where PROCESSNAME is something like "McRecoAprStage1"

  for(int i=0;i<list->GetEntriesFast();i++) {
    TObject* o = list->At(i);
    TBranch* br = dynamic_cast<TBranch*>(o);
    std::string found = br->GetName();
    
    // Does it End with our object type?
    if(found.find(pattern)!=0) continue;
    
    // Does it end with '.'?
    string::size_type p3 = found.find_last_of('.'); 
    if(p3!=found.length()-1 || p3==0) continue;

    // Tokenize by underscore.
    string::size_type p2 = found.rfind("_",p3-1);
    if(p2==string::npos || p2==0) continue;
    
    string::size_type p1 = found.rfind("_",p2-1);
    if(p1==string::npos || p1 ==0 ) continue;

    string::size_type p0 = found.rfind("_",p1-1);
    if(p0==string::npos || p0==0) continue;
    
    art::InputTag tag(found.substr(p0+1,p1-p0-1),  found.substr(p1+1,p2-p1-1), found.substr(p2+1,p3-p2-1));
    retval.push_back( make_pair( found, tag ));
  }
  return retval;
  
}


std::string GalleryRecordComposer::stripdots(const std::string& s)
{
  std::string out = s;
  size_t pos;
  while((pos = out.find('.')) != std::string::npos)  out.erase(pos, 1);
  return out;
}

template<typename V>
void GalleryRecordComposer::composeObjectsVector(const std::string& output_name)
{
  JsonObject reco_list;  // Place to store all objects of type (e.g. all spacepoint lists.)
  TimeReporter cov_timer(output_name);
 
  auto products = findByType<V>(fEvent->getTTree());  // Get a list of all products matching template
  for(auto product: products) {
    std::cout << "Looking at " << boost::core::demangle( typeid(V).name() ) <<" object " << product.first << std::endl;

    TimeReporter timer(product.first);    // This object creates statistics on how long this reco took.
    gallery::Handle<V> handle;            

    { // Create a scope
      boost::mutex::scoped_lock b(fGalleryLock); // Mutex thread lock exists within brace scope
      fEvent->getByLabel(product.second,handle); // Get data from the file
    }
    if(!handle.isValid()) {
      std::cerr << "No data!" << std::endl;
      continue;
    }

    JsonArray jlist;    // List of objects (e.g. Kalman Spacepoints)
    for(const auto& item: *handle) {
      // item is a specific object (e.g. SpacePoint), jitem is the objected moved to JSON (one spacepoint)
      JsonObject jitem;
      composeObject(item,jitem);
      jlist.add(jitem); // Add to list
    }
    reco_list.add(stripdots(product.first),jlist); // Add this list of spacepoints to the list of reco objects
    //timer.addto(fStats);    // Naw, don't need that level of ganularity. Needs mutex.
  }
  {
    boost::mutex::scoped_lock lck(fOutputMutex);  // Scope a lock around the global output object
    fOutput.add(output_name,reco_list);           // Add the output.
    cov_timer.addto(fStats);  
  }  
}
  
template<typename T>
void GalleryRecordComposer::composeObject(const T&, JsonObject& out)
{
  out.add("Unimplimented",JsonElement());
}

template<>
void GalleryRecordComposer::composeObject(const recob::SpacePoint& sp, JsonObject& jsp)
{
  // cout << "Composing spacepoint " << sp.ID() << std::endl;
  jsp.add("id"    ,sp.ID()   );
  jsp.add("chisq" ,sp.Chisq());
  JsonArray xyz;
  xyz.add(sp.XYZ()[0]);
  xyz.add(sp.XYZ()[1]);
  xyz.add(sp.XYZ()[2]);
  
  JsonArray errXyz;
  errXyz.add(sp.ErrXYZ()[0]);
  errXyz.add(sp.ErrXYZ()[1]);
  errXyz.add(sp.ErrXYZ()[2]);
  errXyz.add(sp.ErrXYZ()[3]);
  errXyz.add(sp.ErrXYZ()[4]);
  errXyz.add(sp.ErrXYZ()[5]);

  jsp.add("xyz",xyz);
  jsp.add("errXyz",errXyz);
}





void GalleryRecordComposer::composeHeaderData()
{
  // Header data. Alas, this is the stuff that's nearly impossible to get!
  JsonObject header;
  art::EventAuxiliary const& aux = fEvent->eventAuxiliary();

  header.add("run",aux.id().run());
  header.add("subrun",aux.id().subRun());
  header.add("event",aux.id().event());
  // Todo: build these into a proper javascript-style timestamp.
  double tlow = aux.time().timeLow();
  double thigh = aux.time().timeHigh();
  header.add("timeLow",tlow);
  header.add("timeHigh",thigh);
  header.add("isRealData",aux.isRealData());
  header.add("experimentType",aux.experimentType());


  header.add("seconds",thigh);
  header.add("daqTime",thigh*1000);

  event_time = thigh*1000; // ms
  header.add("eventTime",event_time); // in ms.

  // double swizzler_time = ftr.getF("raw::DAQHeader_daq__Swizzler.obj.fTime");
  // if(swizzler_time>0) {
  //   // It's stored as a time_t.  Shift right 32 bits = divide by this crazy number. Then multiply by 1000 to get ms.
  //   event_time = swizzler_time/4.294967296e+09*1000.;
  // }
  // header.add("swizzlertime",event_time);
  //
  JsonObject trigger;
  {
    auto products = findByType< vector<raw::Trigger> >(fEvent->getTTree());
    for(auto product: products) {

      std::cout << "Looking at " << boost::core::demangle( typeid(raw::Trigger).name() ) <<" object " << product.first << std::endl;
      gallery::Handle< vector<raw::Trigger> > handle;
      {boost::mutex::scoped_lock b(fGalleryLock); fEvent->getByLabel(product.second,handle);}
      if(!handle.isValid()) { continue;  }

      cout << "trigs: " << handle->size() << std::endl;
      for(const raw::Trigger& trg: *handle) {
        cout << "triggerword " << trg.TriggerBits() << std::endl;
        trigger.add("triggerword",trg.TriggerBits());
      }
    }
  }

  // The swtrigger data object is in uboone,
  {
    auto products = findByType< vector<raw::ubdaqSoftwareTriggerData> >(fEvent->getTTree());
    for(auto product: products) {

      std::cout << "Looking at SW Trigger object " << product.first << std::endl;
      gallery::Handle< vector<raw::ubdaqSoftwareTriggerData> > handle;
      {boost::mutex::scoped_lock b(fGalleryLock); fEvent->getByLabel(product.second,handle);}
      if(!handle.isValid()) { continue;  }
      JsonArray sw_triggers;
      cout << "trigs: " << handle->size() << std::endl;
      for(const raw::ubdaqSoftwareTriggerData& swtrig: *handle) {
        for(int i = 0; i< swtrig.getNumberOfAlgorithms(); i++) {
          if(swtrig.getPass(i)) sw_triggers.add(swtrig.getTriggerAlgorithm(i));
        }
      }
      trigger.add("sw_triggers",sw_triggers);
    }
  }
  header.add("trigger",trigger);

  {
    boost::mutex::scoped_lock lck(fOutputMutex);
    fOutput.add("header",header);
  }
}

void GalleryRecordComposer::composeHits()
{
  typedef vector<recob::Hit> current_type_t;
  auto products = findByType<current_type_t>(fEvent->getTTree());

  JsonObject reco_list;
  JsonObject hist_list;
  for(auto product: products) {
    std::cout << "Looking at " << boost::core::demangle( typeid(current_type_t).name() )  <<" object " << product.first << std::endl;
    TimeReporter timer(product.first);

    gallery::Handle< current_type_t > handle;
    {boost::mutex::scoped_lock b(fGalleryLock); fEvent->getByLabel(product.second,handle);}
    if(!handle.isValid()) {
      std::cerr << "No data!" << std::endl;
      continue;
    }
    
    JsonArray arr;
    // Hit histograms.
    TH1D timeProfile("timeProfile","timeProfile",960,0,9600);
    std::vector<TH1*> planeProfile;
    planeProfile.push_back(new TH1D("planeProfile0","planeProfile0",218,0,2398));
    planeProfile.push_back(new TH1D("planeProfile1","planeProfile1",218,0,2398));
    planeProfile.push_back(new TH1D("planeProfile2","planeProfile2",432,0,3456));

    for(const recob::Hit& hit: * handle) {
      JsonObject h;
      int wire = hit.WireID().Wire;
      int plane = hit.WireID().Plane;
      double q  = hit.Integral();
      double t  = hit.PeakTime();
      double t1 = hit.EndTick();
      double t2 = hit.EndTick();

      if(plane==2)timeProfile.Fill(t,q);
      if(plane>=0 && plane<3) planeProfile[plane]->Fill(wire,q);

      h.add("wire",  wire);
      h.add("plane", plane);
      h.add("q",       JsonFixed(q,0)     );
      h.add("t",       JsonFixed(t,1)     );
      h.add("t1",      JsonFixed(t1,1)    );
      h.add("t2",      JsonFixed(t2,1)    );
      arr.add(h);
    }

    reco_list.add(stripdots(product.first),arr);

    JsonObject hists;
    hists.add("timeHist",TH1ToHistogram(&timeProfile));
    JsonArray jPlaneHists;
    jPlaneHists.add(TH1ToHistogram(planeProfile[0]));
    jPlaneHists.add(TH1ToHistogram(planeProfile[1]));
    jPlaneHists.add(TH1ToHistogram(planeProfile[2]));
    hists.add("planeHists",jPlaneHists);

    delete planeProfile[0];
    delete planeProfile[1];
    delete planeProfile[2];
    hist_list.add(stripdots(product.first),hists);
    timer.addto(fStats);
  }
  {
    boost::mutex::scoped_lock lck(fOutputMutex);

    fOutput.add("hits",reco_list);
    fOutput.add("hit_hists",hist_list);
  }
  std::cout << "Hits finishing" << std::endl;
}



void GalleryRecordComposer::composeClusters()
{
 
  typedef vector<recob::Cluster> current_type_t;
  auto products = findByType<current_type_t>(fEvent->getTTree());

  JsonObject reco_list;
  for(auto product: products) {
    std::cout << "Looking at " << boost::core::demangle( typeid(current_type_t).name() ) <<" object " << product.first << std::endl;
    TimeReporter timer(product.first);

    gallery::Handle< current_type_t > handle;
    {boost::mutex::scoped_lock b(fGalleryLock); fEvent->getByLabel(product.second,handle);}
    if(!handle.isValid()) {
      std::cerr << "No data!" << std::endl;
      continue;
    }
    JsonArray jClusters;
    
    for(const recob::Cluster& cluster: *handle) {
      JsonObject jclus;
      jclus.add("ID"         ,cluster.ID());
      jclus.add("view"       ,cluster.View());
      jclus.add("totalCharge",cluster.Integral() );
      jclus.add("Integral",cluster.Integral() );
      jclus.add("NHits",cluster.NHits() );
      jclus.add("EndCharge",cluster.EndCharge() );
      jclus.add("EndAngle",cluster.EndAngle() );
      jclus.add("EndOpeningAngle",cluster.EndOpeningAngle() );
      jclus.add("EndCharge",cluster.EndCharge() );
      jclus.add("EndAngle",cluster.EndAngle() );
      jclus.add("EndOpeningAngle",cluster.EndOpeningAngle() );
      

      jclus.add("EndPos"      ,JsonObject().add("wire",cluster.EndWire()).add("tdc",cluster.EndTick()));
      jclus.add("endPos"        ,JsonObject().add("wire",cluster.EndWire()).add("tdc",cluster.EndTick()));
      jclus.add("sigmaEndPos" ,JsonObject().add("wire",cluster.SigmaEndWire()).add("tdc",cluster.SigmaEndTick()));
      jclus.add("sigmaEndPos"   ,JsonObject().add("wire",cluster.SigmaEndWire()).add("tdc",cluster.SigmaEndTick()));

      jClusters.add(jclus);
    }
    reco_list.add(stripdots(product.first),jClusters);
    timer.addto(fStats);
  }

  {
    boost::mutex::scoped_lock lck(fOutputMutex);
    fOutput.add("clusters",reco_list);    
  }
  std::cout << "Clusters finishing" << std::endl;  
}

void  GalleryRecordComposer::composeEndpoint2d()
{

  typedef vector<recob::EndPoint2D> current_type_t;
  auto products = findByType<current_type_t>(fEvent->getTTree());

  JsonObject reco_list;
  for(auto product: products) {
    std::cout << "Looking at " << boost::core::demangle( typeid(current_type_t).name() ) <<" object " << product.first << std::endl;
    TimeReporter timer(product.first);

    gallery::Handle< current_type_t > handle;
    {boost::mutex::scoped_lock b(fGalleryLock); fEvent->getByLabel(product.second,handle);}
    if(!handle.isValid()) {
      std::cerr << "No data!" << std::endl;
      continue;
    }
    JsonArray jlist;
    
    for(const recob::EndPoint2D& endpoint: *handle) {
      JsonObject jpt;

      jpt.add("id"          ,endpoint.ID()        );
      jpt.add("t"           ,endpoint.DriftTime() );
      jpt.add("plane"       ,endpoint.View()      );
      jpt.add("wire"        ,endpoint.View()      );
      jpt.add("strength"    ,endpoint.Strength()  );
      jpt.add("q"           ,endpoint.Charge()    );

      jlist.add(jpt);
    }
    reco_list.add(stripdots(product.first),jlist);
    timer.addto(fStats);
  }

  {
    boost::mutex::scoped_lock lck(fOutputMutex);
    fOutput.add("endpoint2d",reco_list);    
  }

}

void  GalleryRecordComposer::composeSpacepoints()
{
  composeObjectsVector< std::vector<recob::SpacePoint> >("spacepoints");
  // typedef vector<recob::SpacePoint> current_type_t;
 //  auto products = findByType<current_type_t>(fEvent->getTTree());
 //
 //  JsonObject reco_list;
 //  for(auto product: products) {
 //    std::cout << "Looking at " << boost::core::demangle( typeid(current_type_t).name() ) <<" object " << product.first << std::endl;
 //    TimeReporter timer(product.first);
 //
 //    gallery::Handle< current_type_t > handle;
 //    {boost::mutex::scoped_lock b(fGalleryLock); fEvent->getByLabel(product.second,handle);}
 //    if(!handle.isValid()) {
 //      std::cerr << "No data!" << std::endl;
 //      continue;
 //    }
 //    JsonArray jlist;
 //
 //    for(const recob::SpacePoint& sp: *handle) {
 //      JsonObject jsp;
 //
 //      jsp.add("id"    ,sp.ID()   );
 //      jsp.add("chisq" ,sp.Chisq());
 //      JsonArray xyz;
 //      xyz.add(sp.XYZ()[0]);
 //      xyz.add(sp.XYZ()[1]);
 //      xyz.add(sp.XYZ()[2]);
 //
 //      JsonArray errXyz;
 //      errXyz.add(sp.ErrXYZ()[0]);
 //      errXyz.add(sp.ErrXYZ()[1]);
 //      errXyz.add(sp.ErrXYZ()[2]);
 //      errXyz.add(sp.ErrXYZ()[3]);
 //      errXyz.add(sp.ErrXYZ()[4]);
 //      errXyz.add(sp.ErrXYZ()[5]);
 //
 //      jsp.add("xyz",xyz);
 //      jsp.add("errXyz",errXyz);
 //
 //      jlist.add(jsp);
 //    }
 //    reco_list.add(stripdots(product.first),jlist);
 //    timer.addto(fStats);
 //  }
 //
 //  {
 //    boost::mutex::scoped_lock lck(fOutputMutex);
 //    fOutput.add("spacepoints",reco_list);
 //  }
  
}


void  GalleryRecordComposer::composeTracks()
{
  typedef vector<recob::Track> current_type_t;
  auto products = findByType<current_type_t>(fEvent->getTTree());

  JsonObject reco_list;
  for(auto product: products) {
    std::cout << "Looking at " << boost::core::demangle( typeid(current_type_t).name() ) <<" object " << product.first << std::endl;
    TimeReporter timer(product.first);

    gallery::Handle< current_type_t > handle;
    {boost::mutex::scoped_lock b(fGalleryLock); fEvent->getByLabel(product.second,handle);}
    if(!handle.isValid()) {
      std::cerr << "No data!" << std::endl;
      continue;
    }
    JsonArray jTracks;    
    for(const recob::Track& track: *handle) {
      JsonObject jtrk;

      jtrk.add("id"    ,track.ID());
      jtrk.add("chi2"    ,track.Chi2());
      jtrk.add("ndof"    ,track.Ndof());
      jtrk.add("particleId"    ,track.ParticleId());
      jtrk.add("theta"    ,track.Theta());
      jtrk.add("phi"    ,track.Phi());
      
      const recob::TrackTrajectory& traj = track.Trajectory();
      JsonArray jpoints;
      size_t npoints = traj.NPoints();
      for(size_t i = 0; i< npoints; i++) {
        JsonObject jpoint;
        const auto& xyz = traj.LocationAtPoint(i);
        const auto& mom = traj.MomentumVectorAtPoint(i);
        double p = mom.R();
        recob::Trajectory::Vector_t dir;
        if(p>0) dir = mom/p;
        else    dir = mom;

        jpoint.add("x",xyz.x());
        jpoint.add("y",xyz.y());
        jpoint.add("z",xyz.z());
        jpoint.add("vx",dir.x());
        jpoint.add("vy",dir.y());
        jpoint.add("vz",dir.z());
        jpoint.add("P",p);
        jpoints.add(jpoint);
      }
      jtrk.add("points",jpoints);

      jTracks.add(jtrk);
    }

    reco_list.add(stripdots(product.first),jTracks);
    timer.addto(fStats);
  }

  {
    boost::mutex::scoped_lock lck(fOutputMutex);
    fOutput.add("tracks",reco_list);

  }
  std::cout << "Tracks finishing" << std::endl;

}

// void  GalleryRecordComposer::composeShowers()
// {
//   typedef vector<recob::Shower> current_type_t;
//   auto products = findByType<current_type_t>(fEvent->getTTree());
//
//   JsonObject reco_list;
//   for(auto product: products) {
//     std::cout << "Looking at " << boost::core::demangle( typeid(current_type_t).name() ) <<" object " << product.first << std::endl;
//     TimeReporter timer(product.first);
//
//     gallery::Handle< current_type_t > handle;
//     {boost::mutex::scoped_lock b(fGalleryLock); fEvent->getByLabel(product.second,handle);}
//     if(!handle.isValid()) {
//       std::cerr << "No data!" << std::endl;
//       continue;
//     }
//     JsonArray jTracks;
//     for(const recob::Track& track: *handle) {
//       JsonObject jtrk;
//
//       jtrk.add("id"    ,track.ID());
//       jtrk.add("chi2"    ,track.Chi2());
//       jtrk.add("ndof"    ,track.Ndof());
//       jtrk.add("particleId"    ,track.ParticleId());
//       jtrk.add("theta"    ,track.Theta());
//       jtrk.add("phi"    ,track.Phi());
//
//       const recob::TrackTrajectory& traj = track.Trajectory();
//       JsonArray jpoints;
//       size_t npoints = traj.NPoints();
//       for(size_t i = 0; i< npoints; i++) {
//         JsonObject jpoint;
//         const auto& xyz = traj.LocationAtPoint(i);
//         const auto& mom = traj.MomentumVectorAtPoint(i);
//         double p = mom.R();
//         recob::Trajectory::Vector_t dir;
//         if(p>0) dir = mom/p;
//         else    dir = mom;
//
//         jpoint.add("x",xyz.x());
//         jpoint.add("y",xyz.y());
//         jpoint.add("z",xyz.z());
//         jpoint.add("vx",dir.x());
//         jpoint.add("vy",dir.y());
//         jpoint.add("vz",dir.z());
//         jpoint.add("P",p);
//         jpoints.add(jpoint);
//       }
//       jtrk.add("points",jpoints);
//
//       jTracks.add(jtrk);
//     }
//
//     reco_list.add(stripdots(product.first),jTracks);
//     timer.addto(fStats);
//   }
//
//   {
//     boost::mutex::scoped_lock lck(fOutputMutex);
//     fOutput.add("tracks",reco_list);
//
//   }
//   std::cout << "Tracks finishing" << std::endl;
//
//
//
//
//   vector<string> leafnames = findLeafOfType("vector<recob::Shower>");
//
//   JsonObject reco_list;
//
//   for(size_t iname = 0; iname<leafnames.size(); iname++) {
//     std::string name = leafnames[iname];
//     TimeReporter timer(product.first);
// std::cout << "Looking at " << typeid(current_type_t).name()  <<" object " << product.first << std::endl;
//     JsonArray jShowers;
//     TLeaf* l = fTree->GetLeaf((name+"obj_").c_str());
//     if(!l) continue;
//     int n = l->GetLen();
//     cout << "Found " << n << " objects" << endl;
//
//     TreeElementLooter tel_fTotalEnergy   (fTree,name+"obj.fTotalEnergy");
//     TreeElementLooter tel_fdEdx          (fTree,name+"obj.fdEdx");
//     TreeElementLooter tel_fTotalMIPEnergy(fTree,name+"obj.fTotalMIPEnergy");
//
//     for(int i=0;i<n;i++) {
//       JsonObject jshw;
//
//       jshw.add("id"    ,ftr.getJson(name+"obj.fID"       ,i));
//       JsonObject jEnd;
//       jEnd.add("x", ftr.getJson(name+"obj.fXYZEnd.fX",i));
//       jEnd.add("y", ftr.getJson(name+"obj.fXYZEnd.fY",i));
//       jEnd.add("z", ftr.getJson(name+"obj.fXYZEnd.fZ",i));
//       jshw.add("End",jEnd);
//       JsonObject jdir;
//       jdir.add("x", ftr.getJson(name+"obj.fDCosEnd.fX",i));
//       jdir.add("y", ftr.getJson(name+"obj.fDCosEnd.fY",i));
//       jdir.add("z", ftr.getJson(name+"obj.fDCosEnd.fZ",i));
//       jshw.add("dir",jdir);
//
//       jshw.add("bestPlane",ftr.getJson(name+"obj.fBestPlane",i));
//       jshw.add("Length",ftr.getJson(name+"obj.fLength",i));
//
//       const vector<double> *totEnergy   = tel_fTotalEnergy.get<vector<double>            >(i);
//       jshw.add("totalEnergy",JsonArray(*totEnergy));
//       const vector<double> *dEdx        = tel_fdEdx.get<vector<double>            >(i);
//       jshw.add("dEdx",JsonArray(*dEdx));
//       const vector<double> *totMIPEnergy= tel_fTotalMIPEnergy.get<vector<double>            >(i);
//       jshw.add("totMIPEnergy",JsonArray(*totMIPEnergy));
//
//       jShowers.add(jshw);
//     }
//
//     reco_list.add(stripdots(product.first),jShowers);
//     timer.addto(fStats);
//   }
//   {
//     boost::mutex::scoped_lock lck(fOutputMutex);
//     fOutput.add("showers",reco_list);
//   }
//
// }
//
//
// void GalleryRecordComposer::composePFParticles()
// {
//   vector<string> leafnames = findLeafOfType("vector<recob::PFParticle>");
//
//   JsonObject reco_list;
//
//   for(size_t iname = 0; iname<leafnames.size(); iname++) {
//     std::string name = leafnames[iname];
//     TimeReporter timer(product.first);
//     std::cout << "Looking at PFParticles object " << (name+"obj_").c_str() << endl;
//
//     JsonArray jPFParticles;
//     TLeaf* l = fTree->GetLeaf((name+"obj_").c_str());
//     if(!l) continue;
//     int n = l->GetLen();
//     cout << "Found " << n << " objects" << endl;
//
//     TreeElementLooter lootDaughters(fTree,name+"obj.fDaughters");
//     for(int i=0;i<n;i++) {
//       JsonObject jpf;
//
//       jpf.add("self"    ,ftr.getJson(name+"obj.fSelf"          ,i));
//       jpf.add("pdg"     ,ftr.getJson(name+"obj.fPdgCode"       ,i));
//       jpf.add("parent"  ,ftr.getJson(name+"obj.fParent"        ,i));
//       const std::vector<unsigned long> *ptr = lootDaughters.get<std::vector<unsigned long> >(i);
//       JsonArray daughters(*ptr);
//       jpf.add("daughters",daughters);
//       jPFParticles.add(jpf);
//     }
//     reco_list.add(stripdots(product.first),jPFParticles);
//     timer.addto(fStats);
//   }
//   {
//     boost::mutex::scoped_lock lck(fOutputMutex);
//     fOutput.add("pfparticles",reco_list);
//   }
// }
//
// // Optical
// void  GalleryRecordComposer::composeOpFlashes()
// {
//   vector<string> leafnames = findLeafOfType("vector<recob::OpFlash>");
//   JsonObject reco_list;
//
//   for(size_t iname = 0; iname<leafnames.size(); iname++) {
//     std::string name = leafnames[iname];
//     TimeReporter timer(product.first);
//     std::cout << "Looking at opflash object " << (name+"obj_").c_str() << endl;
//     JsonArray jOpFlashes;
//     TLeaf* l = fTree->GetLeaf((name+"obj_").c_str());
//     if(!l) continue;
//     int n = l->GetLen();
//     cout << "flashes: " << n << endl;
//      //       Double_t recob::OpFlashs_opflash__Reco.obj.fTime
//      // vector<double> recob::OpFlashs_opflash__Reco.obj.fPEperOpDet
//      // vector<double> recob::OpFlashs_opflash__Reco.obj.fWireCenter
//      // vector<double> recob::OpFlashs_opflash__Reco.obj.fWireWidths
//      //       Double_t recob::OpFlashs_opflash__Reco.obj.fYCenter
//      //       Double_t recob::OpFlashs_opflash__Reco.obj.fYWidth
//      //       Double_t recob::OpFlashs_opflash__Reco.obj.fZCenter
//      //       Double_t recob::OpFlashs_opflash__Reco.obj.fZWidth
//      //          Int_t recob::OpFlashs_opflash__Reco.obj.fOnBeamTime
//
//
//     TreeElementLooter tel_fPEperOpDet(fTree,name+"obj.fPEperOpDet");
//     TreeElementLooter tel_fWireCenter(fTree,name+"obj.fWireCenters");
//     TreeElementLooter tel_fWireWidths(fTree,name+"obj.fWireWidths");
//
//     for(int i=0;i<n;i++) {
//       JsonObject jflash;
//       jflash.add("time"       ,ftr.getJson(name+"obj.fTime",i));
//       jflash.add("timeWidth"  ,ftr.getJson(name+"obj.fTimeWidth",i));
//       jflash.add("absTime"    ,ftr.getJson(name+"obj.fAbsTime",i));
//       jflash.add("yCenter"    ,ftr.getJson(name+"obj.fYCenter",i));
//       jflash.add("yWidth"     ,ftr.getJson(name+"obj.fYWidth",i));
//       jflash.add("zCenter"    ,ftr.getJson(name+"obj.fZCenter",i));
//       jflash.add("zWidth"     ,ftr.getJson(name+"obj.fZWidth",i));
//       jflash.add("onBeamTime" ,ftr.getJson(name+"obj.fOnBeamTime",i));
//       jflash.add("inBeamFrame",ftr.getJson(name+"obj.fInBeamFrame",i));
//
//       // auto-construct arrays; lots o' syntactic sugar here.
//       if(tel_fPEperOpDet.ok())  jflash.add("pePerOpDet",     JsonArray(*(tel_fPEperOpDet .get<vector<double> >(i))));
//       const vector<double>* pe_arr = tel_fPEperOpDet .get<vector<double> >(i);
//       double totpe = 0;
//       for(double pe: *pe_arr) totpe+= pe;
//       jflash.add("totPe",totpe);
//
//
//
//       if(tel_fWireCenter.ok())  jflash.add("wireCenter",     JsonArray(*(tel_fWireCenter .get<vector<double> >(i))));
//       if(tel_fWireWidths.ok())  jflash.add("wireWidths",     JsonArray(*(tel_fWireWidths .get<vector<double> >(i))));
//
//       jOpFlashes.add(jflash);
//     }
//     reco_list.add(stripdots(product.first),jOpFlashes);
//     timer.addto(fStats);
//   }
//   {
//     boost::mutex::scoped_lock lck(fOutputMutex);
//     fOutput.add("opflashes",reco_list);
//   }
// }



// void  GalleryRecordComposer::composeOpPulses()
// {
//   vector<string> leafnames = findLeafOfType("vector<raw::OpDetPulse>");
//   JsonObject reco_list;
//
//   for(size_t iname = 0; iname<leafnames.size(); iname++) {
//     std::string name = leafnames[iname];
//     TimeReporter timer(product.first);
//     std::cout << "Looking at ophits object " << (name+"obj_").c_str() << endl;
//     TLeaf* l = fTree->GetLeaf((name+"obj_").c_str());
//     if(!l) continue;
//     int n = l->GetLen();
//     TreeElementLooter loot(fTree,name+"obj.fWaveform");
//     if(!loot.ok()) return;
//
//     JsonArray joppulses;
//     for(int i=0;i<n;i++) {
//
//       int chan    = ftr.getInt(name+"obj.fOpChannel"   ,i);
//       int samples = ftr.getInt(name+"obj.fSamples"     ,i);
//       int frame   = ftr.getInt(name+"obj.fPMTFrame"    ,i);
//       int tdc     = ftr.getInt(name+"obj.fFirstSample" ,i);
//       const std::vector<short> *ptr = loot.get<std::vector<short> >(i);
//       const std::vector<short>& wave = *ptr;
//
//       if(samples > 10000) {
//         // We're dealing with badly-made MC which is just dumping it's waveform content.
//
//         // Scan through the wavform and fake up pulse entries when you see something good.
//         int t = 0;
//         int tot = wave.size();
//         while(t<tot) {
//           if(wave[t] == 0) {t++; continue;}
//
//           // End a pulse.
//           JsonObject jobj;
//           jobj.add("opDetChan"     ,chan    );
//           jobj.add("frame"         ,frame   );
//           jobj.add("tdc"           ,t       );
//           JsonArray jwave;
//           int nsamp = 0;
//           while(t<tot && wave[t]!=0) {
//             jwave.add(wave[t]); nsamp++;  t++;
//             if((t<tot) && wave[t]==0) {jwave.add(wave[t]); nsamp++; t++;} // Add one more - insist that there be two zeroes in a row.
//           }
//           jobj.add("samples",nsamp);
//           jobj.add("waveform",jwave);
//           joppulses.add(jobj);
//           // cout << "Created pulse channel " << chan << " with " << nsamp << " samples " << endl;
//         }
//
//
//       } else {
//         // This appears to be genuine, so we'll reproduce it faithfully.
//         JsonObject jobj;
//         jobj.add("opDetChan"     ,chan    );
//         jobj.add("samples"       ,samples );
//         jobj.add("frame"         ,frame   );
//         jobj.add("tdc"           ,tdc     );
//         JsonArray waveform;
//         for(size_t j=0;j<wave.size();j++) {
//           waveform.add( wave[j] );
//         }
//         jobj.add("waveform",waveform);
//         joppulses.add(jobj);
//
//       }
//
//     }
//
//     reco_list.add(stripdots(product.first),joppulses);
//     timer.addto(fStats);
//   }
//   {
//     boost::mutex::scoped_lock lck(fOutputMutex);
//     fOutput.add("oppulses",reco_list);
//   }
//
// }
//
// void  GalleryRecordComposer::composeOpHits()
// {
//   vector<string> leafnames = findLeafOfType("vector<recob::OpHit>");
//   JsonObject reco_list;
//
//   for(size_t iname = 0; iname<leafnames.size(); iname++) {
//     std::string name = leafnames[iname];
//     TimeReporter timer(product.first);
//     std::cout << "Looking at ophits object " << (name+"obj_").c_str() << endl;
//     TLeaf* l = fTree->GetLeaf((name+"obj_").c_str());
//     if(!l) continue;
//     int n = l->GetLen();
//     cout << "ophits: " << n << endl;
//
//     JsonArray jophits;
//     for(int i=0;i<n;i++) {
//       JsonObject jobj;
//
//       jobj.add("opDetChan"     ,ftr.getJson(name+"obj.fOpChannel"            ,i));
//       jobj.add("peakTime"      ,1e3*ftr.getVal(name+"obj.fPeakTime"             ,i));
//       jobj.add("width"         ,ftr.getJson(name+"obj.fWidth"                ,i));
//       jobj.add("area"          ,ftr.getJson(name+"obj.fArea"                 ,i));
//       jobj.add("amp"           ,ftr.getJson(name+"obj.fAmplitude"            ,i));
//       jobj.add("pe"            ,ftr.getJson(name+"obj.fPE"                   ,i));
//       jobj.add("fastToTotal"   ,ftr.getJson(name+"obj.fFastToTotal"          ,i));
//       jophits.add(jobj);
//     }
//
//     reco_list.add(stripdots(product.first),jophits);
//     timer.addto(fStats);
//   }
//   {
//     boost::mutex::scoped_lock lck(fOutputMutex);
//     fOutput.add("ophits",reco_list);
//   }
// }
//
//
// // void GalleryRecordComposer::wireOfChannel(int channel, int& plane, int& wire)
// // {
// //   if(channel < 2399) {
// //     plane = 0; wire= channel; return;
// //   }
// //   else if(channel <4798) {
// //     plane = 1;
// //     wire = channel - 2399;
// //     return;
// //   }
// //   else{
// //     plane = 2;
// //     wire= channel-4798;
// //     return;
// //   }
// // }
//
//
void GalleryRecordComposer::composeCalAvailability()
{
  typedef vector<recob::Wire> current_type_t;
  auto products = findByType<current_type_t>(fEvent->getTTree());

  JsonObject reco_list;
  for(auto product: products) {
    std::string name = product.first;
    reco_list.add(stripdots(product.first),JsonElement());
  }
  {
    boost::mutex::scoped_lock lck(fOutputMutex);
    fOutput.add("cal",reco_list);
  }
}

void GalleryRecordComposer::composeWires()
{
  typedef vector<recob::Wire> current_type_t;
  auto products = findByType<current_type_t>(fEvent->getTTree());

  JsonObject reco_list;
  JsonObject reco_list2;

  for(auto product: products) {

    std::cout << "Looking at " << boost::core::demangle( typeid(current_type_t).name() ) <<" object " << product.first << std::endl;
    TimeReporter timer(product.first);

    gallery::Handle< current_type_t > handle;
    {boost::mutex::scoped_lock b(fGalleryLock); fEvent->getByLabel(product.second,handle);}
    if(!handle.isValid()) {
      std::cerr << "No data!" << std::endl;
      continue;
    }

    bool is_supernova = (product.second.label() == "sndaq");
    
    size_t nchannels = handle->size();
    if(nchannels<1) {
      std::cout << "No entries in object;" << std::endl;
      continue;
    }

    JsonObject r;
    std::shared_ptr<wiremap_t> wireMap(new wiremap_t);
    std::shared_ptr<wiremap_t> noiseMap(new wiremap_t);
    
    size_t ntdc = handle->begin()->NSignal();
    std::cout << " Channels: " << nchannels << " TDCs: " << ntdc << std::endl;
    if(ntdc<=0) continue;
    
    for(const recob::Wire& wire : *handle) {
      int channel = wire.Channel(); // default
      // std::cout << "Channel " << channel << std::endl;
      waveform_ptr_t waveform_ptr = waveform_ptr_t(new waveform_t( ntdc )); // Storage space
      waveform_ptr_t noiseform_ptr = waveform_ptr_t(new waveform_t( ntdc,  0x7fff )); // Storage space
      
      const recob::Wire::RegionsOfInterest_t & rois = wire.SignalROI();
      for (auto iROI = rois.begin_range(); iROI!=rois.end_range(); ++iROI) {
        const auto& ROI = *iROI;
        const int FirstTick = ROI.begin_index();
        const int EndTick = ROI.end_index();
        float subtract_pedestal = 0;
        if(is_supernova) subtract_pedestal = ROI[FirstTick];
        float amplify = 10;
        if(is_supernova) amplify = 1;
        
        for(int i = FirstTick ; i<= EndTick; i++){
         (*noiseform_ptr)[i] = 0;
         (*waveform_ptr)[i] = (ROI[i]-subtract_pedestal)*amplify;  // Convert float->int
        }

        // std::cout << " roi " << FirstTick << " to " << EndTick << " :: ";
        // for(int i = FirstTick ; i<= EndTick; i++) std::cout << ROI[i]*10 << " ";  // Convert float->int
        // std::cout << endl;
      }
      // Waveform storage.
      if(wireMap->size() <= channel) wireMap->resize(channel+1);
      if(noiseMap->size() <= channel) noiseMap->resize(channel+1);
      (*wireMap)[channel] = waveform_ptr;
      (*noiseMap)[channel] = noiseform_ptr;
      waveform_ptr->_status = gDeadChannelMap->status(channel);
    }

    noiseMap->resize(wireMap->size());

    // Now we should have a semi-complete map.
    int nwire = wireMap->size();
    std::cout << "maxwire:" << nwire << " nwire:" << wireMap->size() << std::endl;
    std::cout << "ntdc :" << ntdc << std::endl;

    MakeEncodedTileset(     r,
                            wireMap,
                            noiseMap,
                            nwire,
                            ntdc,
                            fCacheStoragePath,
                            fCacheStorageUrl,
                            fOptions,
                            true );

    reco_list.add(stripdots(product.first),r);


    {
      JsonObject r2;
      TimeReporter lowres_stats("time_to_make_lowres");
      MakeLowres( r2,
                     wireMap,
                     noiseMap,
                     nwire,
                     ntdc, fCacheStoragePath, fCacheStorageUrl, fOptions, false );
      reco_list2.add(stripdots(product.first),r2);
    }

  }
  {
    boost::mutex::scoped_lock lck(fOutputMutex);

    fOutput.add("cal",reco_list);
    fOutput.add("cal_lowres",reco_list2);
  }
  std::cout << "Wires finishing" << std::endl;
  
}

void GalleryRecordComposer::composeRawAvailability()
{
  typedef vector<raw::RawDigit> current_type_t;
  auto products = findByType<current_type_t>(fEvent->getTTree());

  JsonObject reco_list;
  for(auto product: products) {
    reco_list.add(stripdots(product.first),JsonElement());
  }
  {
    boost::mutex::scoped_lock lck(fOutputMutex);
    fOutput.add("raw",reco_list);
  }
  
}


void GalleryRecordComposer::composeRaw()
{
  
  typedef vector<raw::RawDigit> current_type_t;
  auto products = findByType<current_type_t>(fEvent->getTTree());

  JsonObject reco_list;
  JsonObject reco_list2; // lowres

  for(auto product: products) {
  

    std::cout << "Looking at " << boost::core::demangle( typeid(current_type_t).name() )  <<" object " << product.first << std::endl;
    TimeReporter timer(product.first);

    gallery::Handle< current_type_t > handle;
    {boost::mutex::scoped_lock b(fGalleryLock); fEvent->getByLabel(product.second,handle);}
    if(!handle.isValid()) {
      std::cerr << "No data!" << std::endl;
      continue;
    }

    size_t nchannels = handle->size();
    if(nchannels<1) {
      std::cout << "No entries in object;" << std::endl;
      continue;
    }

    JsonArray jpedestals;
    std::shared_ptr<wiremap_t> wireMap(new wiremap_t);
    std::shared_ptr<wiremap_t> noiseMap(new wiremap_t);

    size_t ntdc = 0;

    for(const raw::RawDigit& rawdigit: *handle) {
      short pedestal = rawdigit.GetPedestal();
      int wire = rawdigit.Channel();
      if(pedestal<0) pedestal = 0; // Didn't read correctly.
      jpedestals.add(pedestal);

      waveform_ptr_t waveform_ptr = waveform_ptr_t(new waveform_t( rawdigit.ADCs() )); // make a copy

      // int planewire,plane;
      // wireOfChannel(wire,plane,planewire);
      waveform_t& waveform = *waveform_ptr;
      size_t nsamp = waveform.size();

      // // Find the pedestal manually.
      waveform_tools::pedestal_computer pedcomp;
      for(int i=0;i<nsamp;i++) pedcomp.fill(waveform[i]);
      pedcomp.finish(20);
      int ped = pedcomp.ped();
      double rms = pedcomp.pedsig(); // auto-adjusted rms.

      for(size_t i =0; i< nsamp; i++) {
        waveform[i] -= ped;
      }
      waveform._status = gDeadChannelMap->status(wire);


      if(wireMap->size() <= wire) wireMap->resize(wire+1);
      (*wireMap)[wire] = waveform_ptr;
      ntdc = max(ntdc,rawdigit.NADC());
    }
    noiseMap->resize(wireMap->size());
    int nwire = wireMap->size();

    CoherentNoiseFilter(wireMap,noiseMap,nwire,ntdc);

    // Now we should have a semi-complete map.
    std::cout << "nwire:" << nwire << std::endl;
    std::cout << "ntdc :" << ntdc << std::endl;
    JsonObject r;
    MakeEncodedTileset(     r,
                            wireMap,
                            noiseMap,
                            nwire,
                            ntdc,
                            fCacheStoragePath,
                            fCacheStorageUrl,
                            fOptions,
                            true );

    reco_list.add(stripdots(product.first),r);

    {
      JsonObject r2;
      TimeReporter lowres_stats("time_to_make_lowres");
      MakeLowres( r2,
                     wireMap,
                     noiseMap,
                     nwire,
                     ntdc, fCacheStoragePath, fCacheStorageUrl, fOptions, false );
      reco_list2.add(stripdots(product.first),r2);
    }

    timer.addto(fStats);
    break; // only 1 raw list.

  }
  {
    boost::mutex::scoped_lock lck(fOutputMutex);
    fOutput.add("raw",reco_list);
    fOutput.add("raw_lowres",reco_list2);
  }
  std::cout << "RawDigits finishing" << std::endl;
  
}
//
//
// int GalleryRecordComposer::pointOffLine(const TLorentzVector& x0, const TLorentzVector& pv, const TLorentzVector& x, double tol)
// {
//   // Ending at x0 and moving along a vector p, how far off the line is point x?
//   TVector3 dx(x.X()-x0.X()
//              ,x.Y()-x0.Y()
//              ,x.Z()-x0.Z());
//   TVector3 p = pv.Vect();
//   double dx_dot_p = dx.Dot(p);
//   double p2 = p.Mag2();
//   if(p2<=0) p2 = 1;
//   double delta2 = dx.Mag2() - (dx_dot_p*dx_dot_p)/p.Mag2();
//   if(delta2 > tol*tol) return 1;
//   if(delta2 < 0) return 1;
//   return 0;
// }
//
// // double distanceOffLine(const TVector3& p, const TVector3& x1, const TVector3 &x2 )
// // {
// //   // Find lambda, the distance along the line segment closest to the point.
// //   // v = vector from p1 to p2
// //   TVector3 v = x2-x1;
// //   TVector3 qp = p-x1;
// //
// //   double v_dot_qp = v.Dot(qp);
// //   double v2 = v.Mag2();
// //   double lam = v_dot_qp/v2;
// //
// //   if(lam<=0) {
// //     // Closest point is p1.
// //     return qp.Mag();
// //   }
// //   if(lam>=1) {
// //     // Closest point is p2
// //     return (p-x2).Mag();
// //   }
// //
// //   // Closest point is along the line.
// //   double qp2 = qp.Mag2();
// //   double d2 = qp2-lam*lam*v2;
// //   return sqrt(d2);
// // }
// void GalleryRecordComposer::composeAuxDets()
// {
//   // On hold. No way I can figure out how to decode a std::set<AuxDetIDE>.
//
//   // vector<string> leafnames = findLeafOfType("vector<sim::AuxDetSimChannel>");
//   // JsonObject reco_list;
//   //
//   // for(size_t iname = 0; iname<leafnames.size(); iname++) {
//   //   std::string name = leafnames[iname];
//   //
//   //   std::cout << "Looking at sim::AuxDetSimChannel " << (name+"obj_").c_str() << endl;
//   //
//   //   JsonArray jAuxDets;
//   //   TLeaf* l = fTree->GetLeaf((name+"obj_").c_str());
//   //   if(!l) continue;
//   //   int n = l->GetLen();
//   //   cout << "auxdets: " << n << endl;
//   //    //       Double_t recob::OpFlashs_opflash__Reco.obj.fTime
//   //    // vector<double> recob::OpFlashs_opflash__Reco.obj.fPEperOpDet
//   //    // vector<double> recob::OpFlashs_opflash__Reco.obj.fWireCenter
//   //    // vector<double> recob::OpFlashs_opflash__Reco.obj.fWireWidths
//   //    //       Double_t recob::OpFlashs_opflash__Reco.obj.fYCenter
//   //    //       Double_t recob::OpFlashs_opflash__Reco.obj.fYWidth
//   //    //       Double_t recob::OpFlashs_opflash__Reco.obj.fZCenter
//   //    //       Double_t recob::OpFlashs_opflash__Reco.obj.fZWidth
//   //    //          Int_t recob::OpFlashs_opflash__Reco.obj.fOnBeamTime
//   //
//   //
//   //   TreeElementLooter tel_fPEperOpDet(fTree,name+"obj.fPEperOpDet");
//   //   TreeElementLooter tel_fWireCenter(fTree,name+"obj.fWireCenter");
//   //   TreeElementLooter tel_fWireWidths(fTree,name+"obj.fWireWidths");
//   //
//   //   for(int i=0;i<n;i++) {
//   //     JsonObject jflash;
//   //     jflash.add("time"       ,ftr.getJson(name+"obj.fTime",i));
//   //     jflash.add("yCenter"    ,ftr.getJson(name+"obj.fYCenter",i));
//   //     jflash.add("yWidth"     ,ftr.getJson(name+"obj.fYWidth",i));
//   //     jflash.add("zCenter"    ,ftr.getJson(name+"obj.fZCenter",i));
//   //     jflash.add("zWidth"     ,ftr.getJson(name+"obj.fZWidth",i));
//   //     jflash.add("onBeamTime" ,ftr.getJson(name+"obj.fOnBeamTime",i));
//   //
//   //
//   // }
// }
//
// void GalleryRecordComposer::composeMC()
// {
//
//   vector<string> leafnames = findLeafOfType("vector<simb::GTruth>");
//   JsonObject mc;
//
//   JsonObject truth_list;
//   for(size_t iname = 0; iname<leafnames.size(); iname++) {
//     std::string name = leafnames[iname];
//     TimeReporter timer(product.first);
//
//     std::vector<std::pair< std::string,std::string> > list;
//     list.push_back(std::make_pair<std::string,std::string>("fGint"                             ,  string(name+"obj.fGint"                    )));
//     list.push_back(std::make_pair<std::string,std::string>("fGscatter"                         ,  string(name+"obj.fGscatter"                )));
//     list.push_back(std::make_pair<std::string,std::string>("fweight"                           ,  string(name+"obj.fweight"                  )));
//     list.push_back(std::make_pair<std::string,std::string>("fprobability"                      ,  string(name+"obj.fprobability"             )));
//     list.push_back(std::make_pair<std::string,std::string>("fXsec"                             ,  string(name+"obj.fXsec"                    )));
//     list.push_back(std::make_pair<std::string,std::string>("fDiffXsec"                         ,  string(name+"obj.fDiffXsec"                )));
//     list.push_back(std::make_pair<std::string,std::string>("fNumPiPlus"                        ,  string(name+"obj.fNumPiPlus"               )));
//     list.push_back(std::make_pair<std::string,std::string>("fNumPiMinus"                       ,  string(name+"obj.fNumPiMinus"              )));
//     list.push_back(std::make_pair<std::string,std::string>("fNumPi0"                           ,  string(name+"obj.fNumPi0"                  )));
//     list.push_back(std::make_pair<std::string,std::string>("fNumProton"                        ,  string(name+"obj.fNumProton"               )));
//     list.push_back(std::make_pair<std::string,std::string>("fNumNeutron"                       ,  string(name+"obj.fNumNeutron"              )));
//     list.push_back(std::make_pair<std::string,std::string>("fIsCharm"                          ,  string(name+"obj.fIsCharm"                 )));
//     list.push_back(std::make_pair<std::string,std::string>("fResNum"                           ,  string(name+"obj.fResNum"                  )));
//     list.push_back(std::make_pair<std::string,std::string>("fgQ2"                              ,  string(name+"obj.fgQ2"                     )));
//     list.push_back(std::make_pair<std::string,std::string>("fgq2"                              ,  string(name+"obj.fgq2"                     )));
//     list.push_back(std::make_pair<std::string,std::string>("fgW"                               ,  string(name+"obj.fgW"                      )));
//     list.push_back(std::make_pair<std::string,std::string>("fgT"                               ,  string(name+"obj.fgT"                      )));
//     list.push_back(std::make_pair<std::string,std::string>("fgX"                               ,  string(name+"obj.fgX"                      )));
//     list.push_back(std::make_pair<std::string,std::string>("fgY"                               ,  string(name+"obj.fgY"                      )));
//     list.push_back(std::make_pair<std::string,std::string>("fFShadSystP4_fP_fBits"             ,  string(name+"obj.fFShadSystP4.fP.fBits"    )));
//     list.push_back(std::make_pair<std::string,std::string>("fFShadSystP4_fP_fX"                ,  string(name+"obj.fFShadSystP4.fP.fX"       )));
//     list.push_back(std::make_pair<std::string,std::string>("fFShadSystP4_fP_fY"                ,  string(name+"obj.fFShadSystP4.fP.fY"       )));
//     list.push_back(std::make_pair<std::string,std::string>("fFShadSystP4_fP_fZ"                ,  string(name+"obj.fFShadSystP4.fP.fZ"       )));
//     list.push_back(std::make_pair<std::string,std::string>("fFShadSystP4_fE"                   ,  string(name+"obj.fFShadSystP4.fE"          )));
//     list.push_back(std::make_pair<std::string,std::string>("fIsSeaQuark"                       ,  string(name+"obj.fIsSeaQuark"              )));
//     list.push_back(std::make_pair<std::string,std::string>("fHitNucP4_fP_fBits"                ,  string(name+"obj.fHitNucP4.fP.fBits"       )));
//     list.push_back(std::make_pair<std::string,std::string>("fHitNucP4_fP_fX"                   ,  string(name+"obj.fHitNucP4.fP.fX"          )));
//     list.push_back(std::make_pair<std::string,std::string>("fHitNucP4_fP_fY"                   ,  string(name+"obj.fHitNucP4.fP.fY"          )));
//     list.push_back(std::make_pair<std::string,std::string>("fHitNucP4_fP_fZ"                   ,  string(name+"obj.fHitNucP4.fP.fZ"          )));
//     list.push_back(std::make_pair<std::string,std::string>("fHitNucP4_fE"                      ,  string(name+"obj.fHitNucP4.fE"             )));
//     list.push_back(std::make_pair<std::string,std::string>("ftgtZ"                             ,  string(name+"obj.ftgtZ"                    )));
//     list.push_back(std::make_pair<std::string,std::string>("ftgtA"                             ,  string(name+"obj.ftgtA"                    )));
//     list.push_back(std::make_pair<std::string,std::string>("ftgtPDG"                           ,  string(name+"obj.ftgtPDG"                  )));
//     list.push_back(std::make_pair<std::string,std::string>("fProbePDG"                         ,  string(name+"obj.fProbePDG"                )));
//     list.push_back(std::make_pair<std::string,std::string>("fProbeP4_fP_fBits"                 ,  string(name+"obj.fProbeP4.fP.fBits"        )));
//     list.push_back(std::make_pair<std::string,std::string>("fProbeP4_fP_fX"                    ,  string(name+"obj.fProbeP4.fP.fX"           )));
//     list.push_back(std::make_pair<std::string,std::string>("fProbeP4_fP_fY"                    ,  string(name+"obj.fProbeP4.fP.fY"           )));
//     list.push_back(std::make_pair<std::string,std::string>("fProbeP4_fP_fZ"                    ,  string(name+"obj.fProbeP4.fP.fZ"           )));
//     list.push_back(std::make_pair<std::string,std::string>("fProbeP4_fE"                       ,  string(name+"obj.fProbeP4.fE"              )));
//     list.push_back(std::make_pair<std::string,std::string>("fVertex_fP_fX"                     ,  string(name+"obj.fVertex.fP.fX"            )));
//     list.push_back(std::make_pair<std::string,std::string>("fVertex_fP_fY"                     ,  string(name+"obj.fVertex.fP.fY"            )));
//     list.push_back(std::make_pair<std::string,std::string>("fVertex_fP_fZ"                     ,  string(name+"obj.fVertex.fP.fZ"            )));
//     list.push_back(std::make_pair<std::string,std::string>("fVertex_fE"                        ,  string(name+"obj.fVertex.fE"               )));
//     JsonArray gtruth_arr = ftr.makeArray(list);
//
//     truth_list.add(stripdots(product.first),gtruth_arr);
//     timer.addto(fStats);
//   }
//   mc.add("gtruth",truth_list);
//
//
//   leafnames = findLeafOfType("vector<simb::MCTruth>");
//   JsonObject mctruth_list;
//   for(size_t iname = 0; iname<leafnames.size(); iname++) {
//     std::string name = leafnames[iname];
//     TimeReporter timer(product.first);
//
//     std::vector<std::pair< std::string,std::string> > list;
//     // Not pulled; maybe I can get away without it?
//     // vector<pair<TLorentzVector,TLorentzVector> > obj.fMCNeutrino.fNu.ftrajectory.ftrajectory
//     // vector<pair<TLorentzVector,TLorentzVector> > obj.fMCNeutrino.fLepton.ftrajectory.ftrajectory
//     //   set<int> obj.fMCNeutrino.fLepton.fdaughters
//     //     set<int> obj.fMCNeutrino.fNu.fdaughters
//
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fstatus"                 , string(name+"obj.fMCNeutrino.fNu.fstatus"                 )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_ftrackId"                , string(name+"obj.fMCNeutrino.fNu.ftrackId"                )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fpdgCode"                , string(name+"obj.fMCNeutrino.fNu.fpdgCode"                )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fmother"                 , string(name+"obj.fMCNeutrino.fNu.fmother"                 )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fprocess"                , string(name+"obj.fMCNeutrino.fNu.fprocess"                )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fmass"                   , string(name+"obj.fMCNeutrino.fNu.fmass"                   )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fpolarization_fX"        , string(name+"obj.fMCNeutrino.fNu.fpolarization.fX"        )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fpolarization_fY"        , string(name+"obj.fMCNeutrino.fNu.fpolarization.fY"        )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fpolarization_fZ"        , string(name+"obj.fMCNeutrino.fNu.fpolarization.fZ"        )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fWeight"                 , string(name+"obj.fMCNeutrino.fNu.fWeight"                 )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fGvtx_fP_fX"             , string(name+"obj.fMCNeutrino.fNu.fGvtx.fP.fX"             )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fGvtx_fP_fY"             , string(name+"obj.fMCNeutrino.fNu.fGvtx.fP.fY"             )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fGvtx_fP_fZ"             , string(name+"obj.fMCNeutrino.fNu.fGvtx.fP.fZ"             )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fGvtx_fE"                , string(name+"obj.fMCNeutrino.fNu.fGvtx.fE"                )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_frescatter"              , string(name+"obj.fMCNeutrino.fNu.frescatter"              )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fstatus"             , string(name+"obj.fMCNeutrino.fLepton.fstatus"             )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_ftrackId"            , string(name+"obj.fMCNeutrino.fLepton.ftrackId"            )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fpdgCode"            , string(name+"obj.fMCNeutrino.fLepton.fpdgCode"            )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fmother"             , string(name+"obj.fMCNeutrino.fLepton.fmother"             )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fprocess"            , string(name+"obj.fMCNeutrino.fLepton.fprocess"            )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fmass"               , string(name+"obj.fMCNeutrino.fLepton.fmass"               )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fpolarization_fX"    , string(name+"obj.fMCNeutrino.fLepton.fpolarization.fX"    )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fpolarization_fY"    , string(name+"obj.fMCNeutrino.fLepton.fpolarization.fY"    )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fpolarization_fZ"    , string(name+"obj.fMCNeutrino.fLepton.fpolarization.fZ"    )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fWeight"             , string(name+"obj.fMCNeutrino.fLepton.fWeight"             )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fGvtx_fP_fX"         , string(name+"obj.fMCNeutrino.fLepton.fGvtx.fP.fX"         )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fGvtx_fP_fY"         , string(name+"obj.fMCNeutrino.fLepton.fGvtx.fP.fY"         )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fGvtx_fP_fZ"         , string(name+"obj.fMCNeutrino.fLepton.fGvtx.fP.fZ"         )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fGvtx_fE"            , string(name+"obj.fMCNeutrino.fLepton.fGvtx.fE"            )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_frescatter"          , string(name+"obj.fMCNeutrino.fLepton.frescatter"          )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fMode"                       , string(name+"obj.fMCNeutrino.fMode"                       )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fInteractionType"            , string(name+"obj.fMCNeutrino.fInteractionType"            )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fCCNC"                       , string(name+"obj.fMCNeutrino.fCCNC"                       )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fTarget"                     , string(name+"obj.fMCNeutrino.fTarget"                     )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fHitNuc"                     , string(name+"obj.fMCNeutrino.fHitNuc"                     )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fHitQuark"                   , string(name+"obj.fMCNeutrino.fHitQuark"                   )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fW"                          , string(name+"obj.fMCNeutrino.fW"                          )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fX"                          , string(name+"obj.fMCNeutrino.fX"                          )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fY"                          , string(name+"obj.fMCNeutrino.fY"                          )));
//     list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fQSqr"                       , string(name+"obj.fMCNeutrino.fQSqr"                       )));
//     list.push_back(std::make_pair<std::string,std::string>( "fOrigin"                                 , string(name+"obj.fOrigin"                                 )));
//     list.push_back(std::make_pair<std::string,std::string>( "fNeutrinoSet"                            , string(name+"obj.fNeutrinoSet"                            )));
//     std::vector<JsonObject> v_mctruths = ftr.makeVector(list);
//
//     // The fPartList object is in fact a vector<simb::MCParticle>, as is read in the next step.
//     // However, the default splitlevel means it's stored as monolithic blocks and has no "obj." stuff.
//     // The only way I can see to get at it is to do a ttreeformula.
//     // However, I think the only thing in there we care about is the track number...?
//
//     for(size_t i=0;i<v_mctruths.size();i++) {
//       TTreeFormula ttf("tff",string(name+"obj.fPartList["+std::to_string((long long)i)+"].ftrackId").c_str(),fTree);
//       int npart = ttf.GetNdata();
//       JsonArray trackids;
//       for(int j = 0;j<npart; j++) {
//         trackids.add((int)ttf.EvalInstance(j));
//       }
//       v_mctruths[i].add("trackIds",trackids);
//     }
//     JsonArray arr(v_mctruths);
//     mctruth_list.add(stripdots(product.first),arr);
//     timer.addto(fStats);
//
//   }
//   mc.add("mctruth",mctruth_list);
//
//   JsonObject particle_list;
//   leafnames = findLeafOfType("vector<simb::MCParticle>");
//
//   for(size_t iname = 0; iname<leafnames.size(); iname++) {
//     std::string name = leafnames[iname];
//     if(fTree->GetLeaf((name+"obj_").c_str())==0) continue;
//     TimeReporter timer(product.first);
//
//     JsonElement::sfDecimals=5;
//     JsonArray gparticle_arr;
//
//     // vector<pair< string,string> > key_leaf_pairs;
//     // // key_leaf_pairs.push_back(make_pair<string,string>("fdaughters"                 , name+"obj.fdaughters"               ));
//     // key_leaf_pairs.push_back(make_pair<string,string>("fmass"                      , name+"obj.fmass"                    ));
//     // key_leaf_pairs.push_back(make_pair<string,string>("fmother"                    , name+"obj.fmother"                  ));
//     // key_leaf_pairs.push_back(make_pair<string,string>("fpdgCode"                   , name+"obj.fpdgCode"                 ));
//     // key_leaf_pairs.push_back(make_pair<string,string>("fprocess"                   , name+"obj.fprocess"                 ));
//     // key_leaf_pairs.push_back(make_pair<string,string>("frescatter"                 , name+"obj.frescatter"               ));
//     // key_leaf_pairs.push_back(make_pair<string,string>("fstatus"                    , name+"obj.fstatus"                  ));
//     // key_leaf_pairs.push_back(make_pair<string,string>("ftrackId"                   , name+"obj.ftrackId"                 ));
//     // key_leaf_pairs.push_back(make_pair<string,string>("fWeight"                    , name+"obj.fWeight"                  ));
//     // key_leaf_pairs.push_back(make_pair<string,string>("fGvtx.fE"                   , name+"obj.fGvtx.fE"                 ));
//     // key_leaf_pairs.push_back(make_pair<string,string>("fGvtx.fP.fX"                , name+"obj.fGvtx.fP.fX"              ));
//     // key_leaf_pairs.push_back(make_pair<string,string>("fGvtx.fP.fY"                , name+"obj.fGvtx.fP.fY"              ));
//     // key_leaf_pairs.push_back(make_pair<string,string>("fGvtx.fP.fZ"                , name+"obj.fGvtx.fP.fZ"              ));
//     // key_leaf_pairs.push_back(make_pair<string,string>("fpolarization.fX"           , name+"obj.fpolarization.fX"         ));
//     // key_leaf_pairs.push_back(make_pair<string,string>("fpolarization.fY"           , name+"obj.fpolarization.fY"         ));
//     // key_leaf_pairs.push_back(make_pair<string,string>("fpolarization.fZ"           , name+"obj.fpolarization.fZ"         ));
//
//
//
//     TLeaf* lp_fmass      = fTree->GetLeaf( (name+"obj.fmass"     ).c_str());
//     TLeaf* lp_fmother    = fTree->GetLeaf( (name+"obj.fmother"   ).c_str());
//     TLeaf* lp_fpdgCode   = fTree->GetLeaf( (name+"obj.fpdgCode"  ).c_str());
//     TLeaf* lp_fprocess   = fTree->GetLeaf( (name+"obj.fprocess"  ).c_str());
//     TLeaf* lp_frescatter = fTree->GetLeaf( (name+"obj.frescatter").c_str());
//     TLeaf* lp_fstatus    = fTree->GetLeaf( (name+"obj.fstatus"   ).c_str());
//     TLeaf* lp_ftrackId   = fTree->GetLeaf( (name+"obj.ftrackId"  ).c_str());
//     TLeaf* lp_fWeight    = fTree->GetLeaf( (name+"obj.fWeight"   ).c_str());
//
//     TreeElementLooter tel_fprocess(fTree,name+"obj.fprocess");
//
//     TLeaf* lf = fTree->GetLeaf((name+"obj_").c_str());
//     if(!lf) return;
//     int nparticles = lf->GetLen();
//     TreeElementLooter l(fTree,name+"obj.ftrajectory.ftrajectory");
//     if(!l.ok()) continue;
//
//     std::cout << "Making particle list " << name << " " << nparticles << std::endl;
//
//     std::vector<int> v_countDaughters(nparticles,0);
//     for(int i=0;i<nparticles;i++) {
//       int mom =  ftr.getInt(lp_fmother ,i  );
//       if(mom<0) continue;
//       if(mom>= v_countDaughters.size()) continue;
//       v_countDaughters[mom]++;
//     }
//
//     JsonArray j_particles;
//     int nkeep = 0;
//     for(int i=0;i<nparticles;i++) {
//       const std::vector<pair<TLorentzVector,TLorentzVector> > *traj;
//       traj = l.get<std::vector<pair<TLorentzVector,TLorentzVector> > >(i);
//       int n = traj->size();
//       if(n<1) continue;
//
//       // Find total trajectory length.
//       TLorentzVector xfirst = ((*traj)[0].first);
//       TLorentzVector xlast = ((*traj)[n-1].first);
//       TVector3 dx = xlast.Vect()-xfirst.Vect();
//       if( (dx.Mag() < 0.3) && (v_countDaughters[i] <1) ) {
//         // What a useless particle!  No daughters, no track length. Skip it.
//         j_particles.add(JsonElement(0)); // add a null object
//         continue;
//       }
//
//       JsonObject jparticle;
//       jparticle.add("fmass"     , ftr.getInt(lp_fmass     ,i));
//       jparticle.add("fmother"   , ftr.getInt(lp_fmother   ,i));
//       jparticle.add("fpdgCode"  , ftr.getInt(lp_fpdgCode  ,i));
//       // jparticle.add("fprocess"  , ftr.getInt(lp_fprocess  ,i));
//       const std::string  *process           = tel_fprocess.get<std::string>(i);
//       if(process) jparticle.add("fprocess"  , *process);
//       jparticle.add("frescatter", ftr.getInt(lp_frescatter,i));
//       jparticle.add("fstatus"   , ftr.getInt(lp_fstatus   ,i));
//       jparticle.add("ftrackId"  , ftr.getInt(lp_ftrackId  ,i));
//       jparticle.add("fWeight"   , ftr.getVal(lp_fWeight   ,i));
//
//       // Trajectory
//       JsonArray jtraj;
//       TLorentzVector x_last  = ((*traj)[0].first);
//       TLorentzVector p_last  = ((*traj)[0].second);
//       int n_need = 1;
//       for(int j=0;j<n;j++) {
//         TLorentzVector x   = ((*traj)[j].first);
//         TLorentzVector p   = ((*traj)[j].second);
//
//         if(  j==0  // keep first point
//           || j==n-1  // keep last point
//           || pointOffLine(x_last,p_last,x,0.15)) // keep any point not on projected line within a 0.15 cm tolerance
//         {
//           // Keep this point.
//           JsonObject trajpoint;
//
//           const TLorentzVector& pos = (*traj)[j].first;
//           const TLorentzVector& mom = (*traj)[j].second;
//           // trajpoint.add("acc",ptAcc[j]);
//           trajpoint.add("x",JsonFixed(x.X(),1));
//           trajpoint.add("y",JsonFixed(x.Y(),1));
//           trajpoint.add("z",JsonFixed(x.Z(),1));
//           trajpoint.add("t",JsonFixed(x.T(),1));
//           trajpoint.add("px",JsonFixed(p.X(),4));
//           trajpoint.add("py",JsonFixed(p.Y(),4));
//           trajpoint.add("pz",JsonFixed(p.Z(),4));
//           trajpoint.add("E" ,JsonFixed(p.T(),6));
//           jtraj.add(trajpoint);
//           x_last = x;
//           p_last = p;
//         }
//       }
//       jparticle.add("trajectory",jtraj);
//
//       nkeep++;
//       j_particles.add(jparticle);
//     }
//
//     particle_list.add(stripdots(product.first),j_particles);
//     timer.addto(fStats);
//
//     std::cout << "Made particle list " << name << " " << nkeep << std::endl;
//
//   }
//   mc.add("particles",particle_list);
//
//   {
//     boost::mutex::scoped_lock lck(fOutputMutex);
//     fOutput.add("mc",mc);
//   }
// }

template<typename A, typename B>
void GalleryRecordComposer::composeAssociation(std::map<string, JsonObject>& assn_list)
{
  typedef art::Assns<A,B> assn_t;

  for(auto product: findByType<assn_t>(fEvent->getTTree())) {
    gallery::Handle< assn_t > assnhandle;
    {boost::mutex::scoped_lock b(fGalleryLock); fEvent->getByLabel(product.second,assnhandle);}
    if(assnhandle->size()>0) {
      std::pair<art::Ptr<A>,art::Ptr<B>> p = *assnhandle->begin();
      // std::cout << p.first.id() << "\t" << p.first.key() << std::endl;
      const art::BranchDescription* desc_a = fEvent->dataGetterHelper()->branchMapReader().productToBranch(p.first.id());
      const art::BranchDescription* desc_b = fEvent->dataGetterHelper()->branchMapReader().productToBranch(p.second.id());
      std::string a_name = stripdots(desc_a->branchName());
      std::string b_name = stripdots(desc_b->branchName());
      // OK, so now we're ready to build the association maps.
      std::vector< JsonArray > a_to_b;
      std::vector< JsonArray > b_to_a;
      for(const auto& assnpair: *assnhandle) {        
        int a_id = assnpair.first.key();
        int b_id = assnpair.second.key();
        // Trap wierd values.
        if(a_id<0 || b_id <0) continue;
        if(a_to_b.size() <= a_id) a_to_b.resize(a_id+1);
        a_to_b[a_id].add(b_id);
        if(b_to_a.size() <= b_id) b_to_a.resize(b_id+1);
        b_to_a[b_id].add(a_id);
      }
    
      // Create the JSON objects, which are also arrays-of-arrays. Some arrays are empty.
      JsonArray j_a_to_b;
      for(size_t j=0;j<a_to_b.size();j++) { j_a_to_b.add(a_to_b[j]); }
      JsonArray j_b_to_a;
      for(size_t j=0;j<b_to_a.size();j++) { j_b_to_a.add(b_to_a[j]); }
      
      // Now push these into the maps.
      assn_list[a_name].add(b_name,j_a_to_b);
      assn_list[b_name].add(a_name,j_b_to_a);      
    }    
  }
}

void GalleryRecordComposer::composeAssociations()
{
  TimeReporter timer("Associations");
    
  JsonObject assns;
  std::map<std::string, JsonObject> assn_list;

  // composeAssociation<anab::Calorimetry,recob::Track>(assn_list);
  // composeAssociation<anab::CosmicTag,recob::Hit>(assn_list);
  // composeAssociation<anab::CosmicTag,recob::PFParticle>(assn_list);
  // composeAssociation<anab::CosmicTag,recob::Track>(assn_list);
  // composeAssociation<anab::ParticleID,recob::Track>(assn_list);
  // composeAssociation<anab::T0,recob::Track>(assn_list);
  composeAssociation<raw::RawDigit,recob::Hit>(assn_list);
  composeAssociation<raw::RawDigit,recob::Wire>(assn_list);
  composeAssociation<recob::Cluster,recob::EndPoint2D>(assn_list);
  composeAssociation<recob::Cluster,recob::Hit>(assn_list);
  composeAssociation<recob::Cluster,recob::PFParticle>(assn_list);
  composeAssociation<recob::Cluster,recob::Shower>(assn_list);
  composeAssociation<recob::Cluster,recob::Vertex>(assn_list);
  composeAssociation<recob::Hit,recob::Seed>(assn_list);
  composeAssociation<recob::Hit,recob::Shower>(assn_list);
  composeAssociation<recob::Hit,recob::SpacePoint>(assn_list);
  composeAssociation<recob::Hit,recob::Track>(assn_list);
  composeAssociation<recob::Hit,recob::Wire>(assn_list);
  composeAssociation<recob::OpFlash,recob::OpHit>(assn_list);
  composeAssociation<recob::PFParticle,recob::Seed>(assn_list);
  composeAssociation<recob::PFParticle,recob::Shower>(assn_list);
  composeAssociation<recob::PFParticle,recob::SpacePoint>(assn_list);
  composeAssociation<recob::PFParticle,recob::Track>(assn_list);
  composeAssociation<recob::PFParticle,recob::Vertex>(assn_list);
  composeAssociation<recob::SpacePoint,recob::Track>(assn_list);
  composeAssociation<recob::Track,recob::Vertex>(assn_list);
  composeAssociation<simb::GTruth,simb::MCTruth>(assn_list);
  composeAssociation<simb::MCFlux,simb::MCTruth>(assn_list);
  composeAssociation<simb::MCParticle,simb::MCTruth>(assn_list);

  // Add maps to output object.
  for(auto& assn: assn_list) {
    assns.add(assn.first, assn.second);
  }
  cout << "Association total size: " << assns.str().length() << std::endl;
  {
    boost::mutex::scoped_lock lck(fOutputMutex);
    fOutput.add("associations",assns);
    fStats.add("Associations",timer.t.Count());
    
  }
}


void GalleryRecordComposer::compose()
{
  std::cout << "GALLERY COMPOSER!!!" << std::endl;
  fCurrentEventDirname = fCacheStoragePath;
  fCurrentEventUrl     = fCacheStorageUrl;
  
  fOutput.add("converter","ComposeResult.cpp $Revision$ $Date$ ");

  // parse some options.
  int doCal = 1;
  int doRaw = 1;
  if( std::string::npos != fOptions.find("_NOCAL_")) doCal = 0;
  if( std::string::npos != fOptions.find("_NORAW_")) doRaw = 0;


  // Go to required event
  // FIXME: PROBABLY HUGELY INEFFICIENT; need to implement GoTo in Event
  fEvent->toBegin();
  for(int i=0;i<fEntry;i++) fEvent->next();

  composeHeaderData();

  if(!doCal) composeCalAvailability(); // just look at branch names.
  if(!doRaw) composeRawAvailability();

  
  
  
  //
  // OK, now build the result.
  //

  // composeHeaderData();
  // Wire data.
  // End first so background image conversion tasks can be Ended as we build the rest.


  if(doCal)   composeWires();
  if(doRaw)   composeRaw();
  composeHits();
  composeClusters();
  composeTracks();
  composeEndpoint2d();
  composeSpacepoints();
  composeAssociations();


  boost::thread_group threads;
  // if(doCal)   threads.create_thread(boost::bind(&GalleryRecordComposer::composeWires,this));
  // if(doRaw)   threads.create_thread(boost::bind(&GalleryRecordComposer::composeRaw,this));

  // threads.create_thread(boost::bind(&GalleryRecordComposer::composeHits,this));
  // threads.create_thread(boost::bind(&GalleryRecordComposer::composeClusters,this));
  // threads.create_thread(boost::bind(&GalleryRecordComposer::composeEndpoint2d,this));
  // threads.create_thread(boost::bind(&GalleryRecordComposer::composeSpacepoints,this));
  // threads.create_thread(boost::bind(&GalleryRecordComposer::composeTracks,this));
  // threads.create_thread(boost::bind(&GalleryRecordComposer::composeShowers,this));
  // threads.create_thread(boost::bind(&GalleryRecordComposer::composePFParticles,this));
  //
  // // Optical
  // threads.create_thread(boost::bind(&GalleryRecordComposer::composeOpPulses,this));
  // threads.create_thread(boost::bind(&GalleryRecordComposer::composeOpFlashes,this));
  // threads.create_thread(boost::bind(&GalleryRecordComposer::composeOpHits,this));
  // threads.create_thread(boost::bind(&GalleryRecordComposer::composeAuxDets,this));
  //
  // threads.create_thread(boost::bind(&GalleryRecordComposer::composeMC,this));
  // threads.create_thread(boost::bind(&GalleryRecordComposer::composeAssociations,this));
  //
    
  threads.join_all();
  // Database lookup.
  // slomon_thread.join();
  // JsonElement hv; hv.setStr(slm.val);
  // fOutput.add("hv",hv);
    
  fOutput.add("stats",fStats);
  
  
}





