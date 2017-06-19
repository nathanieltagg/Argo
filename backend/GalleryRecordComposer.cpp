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
#include "lardataobj/RawData/RawDigit.h"
#include "lardataobj/RawData/OpDetPulse.h"
#include "lardataobj/RecoBase/Wire.h"
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
vector<std::pair<string,art::InputTag>>  GalleryRecordComposer::findByType(TTree* fTree)
{
  // First, have we initialized our branch list for quick access?
  if(fBranchNames.size()==0) {
    TObjArray* list = fTree->GetListOfBranches();
    for(int i=0;i<list->GetEntriesFast();i++) {
      TObject* o = list->At(i);
      TBranch* br = dynamic_cast<TBranch*>(o);
      std::string found = br->GetName();
  
      // Does it end with '.'?
      string::size_type p3 = found.find_last_of('.'); 
      if(p3!=found.length()-1 || p3==0) continue;
      
      fBranchNames.push_back(found);
    }
    std::sort(fBranchNames.begin(),fBranchNames.end());
  }

  vector<std::pair<string,art::InputTag>> retval;
  // Leaf names for std::vector<recob::Wire> get renamed
  // to the art version of "recob::Wires" by this. 
  std::string pattern = art::TypeID(typeid(T)).friendlyClassName() + '_';
  std::cout << "Looking for leaf of type " << pattern << "label_instance_process." << endl;

  // Look through every branch name.
  
  // We're looking for:
  // OBJ_LABEL_INSTANCE_PROCESSNAME.obj_
  // Where OBJ is something like "recob::Wires"
  // Where LABEL is something like "pandora"
  // INSTANCE is usually (always?) blank
  // Where PROCESSNAME is something like "McRecoAprStage1"

  auto p1 = std::lower_bound(fBranchNames.begin(),fBranchNames.end(),pattern);
  for(auto p=p1; p!=fBranchNames.end(); p++) {
    const std::string& found = *p;
    // Does it begin with our object type?
    if(found.find(pattern)!=0) return retval; // finished

    // It's a match, so tokenize and return.
    // Tokenize by underscore.
    string::size_type p3 = found.length()-1; // skip trailing '.'.
    
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
    //
  // auto p2 = std::upper_bound(fBranchNames.begin(),fBranchNames.end(),pattern);
  //
  // std::cout << "Looking for " << pattern << std::endl;
  // std::cout << "Is p1<=p2? " << ((p1<=p2)?"yes":"no") << std::endl;
  // if(p1 != fBranchNames.begin()) {
  //   std::cout << " Before:    " << *(p1-1) << std::endl;
  // }
  // for(auto p = p1; p<=p2 && p!=fBranchNames.end(); p++) {
  //   std::cout << " Candidate: " << *p << std::endl;
  // }
  // if(p2!= fBranchNames.end() && (p2+1)!=fBranchNames.end()) {
  //   std::cout << " After:     " << *(p2+1) << std::endl;
  //
  // }
  // // for(int i=0;i<list->GetEntriesFast();i++) {
  //   TObject* o = list->At(i);
  //   TBranch* br = dynamic_cast<TBranch*>(o);
  //   std::string found = br->GetName();
  //
  //   // Does it begin with our object type?
  //   if(found.find(pattern)!=0) continue;
  //
  //   // Does it end with '.'?
  //   string::size_type p3 = found.find_last_of('.');
  //   if(p3!=found.length()-1 || p3==0) continue;
  //
  //   // Tokenize by underscore.
  //   string::size_type p2 = found.rfind("_",p3-1);
  //   if(p2==string::npos || p2==0) continue;
  //
  //   string::size_type p1 = found.rfind("_",p2-1);
  //   if(p1==string::npos || p1 ==0 ) continue;
  //
  //   string::size_type p0 = found.rfind("_",p1-1);
  //   if(p0==string::npos || p0==0) continue;
  //
  //   art::InputTag tag(found.substr(p0+1,p1-p0-1),  found.substr(p1+1,p2-p1-1), found.substr(p2+1,p3-p2-1));
  //   retval.push_back( make_pair( found, tag ));
  // }
  return retval;
  
}


std::string stripdots(const std::string& s)
{
  std::string out = s;
  size_t pos;
  while((pos = out.find('.')) != std::string::npos)  out.erase(pos, 1);
  return out;
}

template<typename V>
bool GalleryRecordComposer::composeObjectsVector(const std::string& output_name, JsonObject& output)
{
  JsonObject reco_list;  // Place to store all objects of type (e.g. all spacepoint lists.)
  TimeReporter cov_timer(output_name);
 
  int found = 0;
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
    found++;
    
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
    output.add(output_name,reco_list);           // Add the output.
    cov_timer.addto(fStats);  
  }  
  return(found>0);
}
  
template<typename T>
void GalleryRecordComposer::composeObject(const T&, JsonObject& out)
{
  out.add("Unimplimented",JsonElement());
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
  TimeReporter toptimer("hits");

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
      double t1 = hit.StartTick();
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
    //timer.addto(fStats);
  }
  {
    boost::mutex::scoped_lock lck(fOutputMutex);

    toptimer.addto(fStats);

    fOutput.add("hits",reco_list);
    fOutput.add("hit_hists",hist_list);
  }
  std::cout << "Hits finishing" << std::endl;
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

  // Error matrix isn't used and takes up lots of space.
  // JsonArray errXyz;
  // errXyz.add(sp.ErrXYZ()[0]);
  // errXyz.add(sp.ErrXYZ()[1]);
  // errXyz.add(sp.ErrXYZ()[2]);
  // errXyz.add(sp.ErrXYZ()[3]);
  // errXyz.add(sp.ErrXYZ()[4]);
  // errXyz.add(sp.ErrXYZ()[5]);

  jsp.add("xyz",xyz);
  // jsp.add("errXyz",errXyz);
}

template<>
void GalleryRecordComposer::composeObject(const recob::Track& track, JsonObject& jtrk)
{
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

    jpoint.add("x",JsonFixed(xyz.x(),2));
    jpoint.add("y",JsonFixed(xyz.y(),2));
    jpoint.add("z",JsonFixed(xyz.z(),2));
    if((i==0) || (i==(npoints-1))) { // save space by not including direction.  This kills BEZIER tracks!
      recob::Trajectory::Vector_t dir;
      if(p>0) dir = mom/p;
      else    dir = mom;
      jpoint.add("vx",JsonFixed(dir.x(),4));
      jpoint.add("vy",JsonFixed(dir.y(),4));
      jpoint.add("vz",JsonFixed(dir.z(),4));
    }

    jpoint.add("P",p);

    jpoints.add(jpoint);
  }
  jtrk.add("points",jpoints);
}

template<>
void GalleryRecordComposer::composeObject(const recob::Shower& shower, JsonObject& jshw)
{

  jshw.add("id"    ,shower.ID());
  TVector3 const& xyz = shower.ShowerStart();
  JsonObject jstart;
  jstart.add("x", xyz.x() );
  jstart.add("y", xyz.y() );
  jstart.add("z", xyz.z() );
  jshw.add("start",jstart);

  TVector3 const& dir = shower.Direction();
  JsonObject jdir;
  jdir.add("x", dir.x() );
  jdir.add("y", dir.y() );
  jdir.add("z", dir.z() );
  jshw.add("dir",jdir);
  
  JsonObject jEnd;
  jEnd.add("x", xyz.x() );
  jEnd.add("y", xyz.y() );
  jEnd.add("z", xyz.z() );
  jshw.add("end",jEnd);


  jshw.add("bestPlane",shower.best_plane() );
  jshw.add("Length", shower.Length() );

  jshw.add("totalEnergy",JsonArray(shower.Energy())); // Implicit Conversion from vector<double> to JsonArray
  jshw.add("dEdx",JsonArray(shower.dEdx())); // ditto
  jshw.add("totMIPEnergy",JsonArray(shower.MIPEnergy())); // ditto
}


template<>
void GalleryRecordComposer::composeObject(const recob::PFParticle& p, JsonObject& jpf)
{
  jpf.add("self"    ,p.Self()    );
  jpf.add("pdg"     ,p.PdgCode() );
  jpf.add("parent"  ,p.Parent()  ); 
  jpf.add("daughters", JsonArray(p.Daughters())); // Implicit conversion vector<size_t> to JsonArray
}

template<>
void GalleryRecordComposer::composeObject(const recob::OpFlash& flash, JsonObject& jflash)
{
  jflash.add("time"       ,flash.Time()       ); 
  jflash.add("timeWidth"  ,flash.TimeWidth()  ); 
  jflash.add("absTime"    ,flash.AbsTime()    ); 
  jflash.add("yCenter"    ,flash.YCenter()    ); 
  jflash.add("yWidth"     ,flash.YWidth()     ); 
  jflash.add("zCenter"    ,flash.ZCenter()    ); 
  jflash.add("zWidth"     ,flash.ZWidth()     ); 
  jflash.add("onBeamTime" ,flash.OnBeamTime() ); 
  jflash.add("inBeamFrame",flash.InBeamFrame()); 

  // Would have to pull it out one at a time. But I don't think I use this.
  //jflash.add("pePerOpDet",     JsonArray(*(tel_fPEperOpDet .get<vector<double> >(i))));
  jflash.add("totPe",flash.TotalPE());

  // auto-construct arrays; lots o' syntactic sugar here.
  jflash.add("wireCenter",     JsonArray(flash.WireCenters()));
  jflash.add("wireWidths",     JsonArray(flash.WireWidths() ));
}


template<>
void GalleryRecordComposer::composeObject(const raw::OpDetPulse& pulse, JsonObject& jobj)
{
  jobj.add("opDetChan", pulse.OpChannel());
  jobj.add("samples", pulse.Samples());
  jobj.add("tdc", pulse.FirstSample());
  jobj.add("frame", pulse.PMTFrame());
  // In fact, this class is fundamentally broken: there is no const version of Waveform(), so the data is write-only! 
  // if(pulse.Samples() < 10000) {
    // jobj.add("waveform",JsonArray(pulse.Waveform()));
  // }
}

template<>
void GalleryRecordComposer::composeObject(const recob::OpHit& hit, JsonObject& jobj)
{
  jobj.add("opDetChan"     ,hit.OpChannel());
  jobj.add("peakTime"      ,1e3*hit.PeakTime());
  jobj.add("width"         ,hit.Width());
  jobj.add("area"          ,hit.Area());
  jobj.add("amp"           ,hit.Amplitude());
  jobj.add("pe"            ,hit.PE());
  jobj.add("fastToTotal"   ,hit.FastToTotal());
}

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
int GalleryRecordComposer::pointOffLine(const TLorentzVector& x0, const TLorentzVector& pv, const TLorentzVector& x, double tol)
{
  // Ending at x0 and moving along a vector p, how far off the line is point x?
  TVector3 dx(x.X()-x0.X()
             ,x.Y()-x0.Y()
             ,x.Z()-x0.Z());
  TVector3 p = pv.Vect();
  double dx_dot_p = dx.Dot(p);
  double p2 = p.Mag2();
  if(p2<=0) p2 = 1;
  double delta2 = dx.Mag2() - (dx_dot_p*dx_dot_p)/p.Mag2();
  if(delta2 > tol*tol) return 1;
  if(delta2 < 0) return 1;
  return 0;
}
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





// These need to be in order or forward-declared...

JsonObject pos_to_json(const TLorentzVector& v)
{
  JsonObject j;
  j.add("x",v.X());
  j.add("y",v.Y());
  j.add("z",v.Z());
  j.add("t",v.T());
  return j;
}

JsonObject mom_to_json(const TLorentzVector& v)
{
  JsonObject j;
  j.add("px",v.X());
  j.add("py",v.Y());
  j.add("pz",v.Z());
  j.add("E",v.E());
  return j;
}

template<>
void GalleryRecordComposer::composeObject(const simb::MCParticle& particle, JsonObject& jobj)
{
  if(particle.TrackId() == std::numeric_limits<int>::min()) return;
  jobj.add("ftrackId"     ,particle.TrackId());
  jobj.add("fstatus"      ,particle.StatusCode());
  jobj.add("fpdgCode"     ,particle.PdgCode());
  jobj.add("fmother"      ,particle.Mother());
  jobj.add("process"      ,particle.Process());
  jobj.add("endProcess"   ,particle.EndProcess());
  jobj.add("fmass"        ,particle.Mass());
  jobj.add("weight"      ,particle.Weight());
  jobj.add("rescatter"   ,particle.Rescatter());

  // Trajectory. Make a copy so we can sparsify it.
  JsonArray jtraj;
  const simb::MCTrajectory& traj = particle.Trajectory();
  size_t n = traj.size();
  if(n==0) return;
  // simb::MCTrajectory my_traj(particle.Trajectory());
  // my_traj.Sparsify();
  // // cout << "Particles before sparsification: " << particle.Trajectory().size() << " after " << my_traj.size() << std::endl;
  //
  // for(auto pt: my_traj )
  // {
  //   JsonObject trajpoint;
  //   trajpoint.add("x", JsonFixed(pt.first.X(),1));
  //   trajpoint.add("y", JsonFixed(pt.first.Y(),1));
  //   trajpoint.add("z", JsonFixed(pt.first.Z(),1));
  //   trajpoint.add("t", JsonFixed(pt.first.T(),1));
  //   trajpoint.add("px",JsonFixed(pt.second.X(),4));
  //   trajpoint.add("py",JsonFixed(pt.second.Y(),4));
  //   trajpoint.add("pz",JsonFixed(pt.second.Z(),4));
  //   trajpoint.add("E" ,JsonFixed(pt.second.T(),6));
  //   jtraj.add(trajpoint);
  // }
  // jobj.add("trajectory",jtraj);

  
  // My version of sparsification is more aggressive than the built-in version.
  TLorentzVector x_last  = (traj[0].first);
  TLorentzVector p_last  = (traj[0].second);
  size_t j  = 0;
  for(const auto& pt: traj) {
    TLorentzVector x   = (pt.first);
    TLorentzVector p   = (pt.second);
    
    if(  j==0  // keep first point
      || j==n-1  // keep last point
      || pointOffLine(x_last,p_last,x,0.2)) // keep any point not on projected line within a 0.2 cm tolerance
    {
      // Keep this point.
      JsonObject trajpoint;
      
      trajpoint.add("x",JsonFixed(x.X(),1));
      trajpoint.add("y",JsonFixed(x.Y(),1));
      trajpoint.add("z",JsonFixed(x.Z(),1));
      trajpoint.add("t",JsonFixed(x.T(),1));
      trajpoint.add("px",JsonFixed(p.X(),4));
      trajpoint.add("py",JsonFixed(p.Y(),4));
      trajpoint.add("pz",JsonFixed(p.Z(),4));
      trajpoint.add("E" ,JsonFixed(p.T(),6));
      jtraj.add(trajpoint); 
      x_last = x;
      p_last = p;
      j++;
    }
  }
  jobj.add("trajectory",jtraj);
  
}



const char* lookupmode(int mode)
{
  switch(mode) {
    case simb::kUnknownInteraction            : return "UnknownInteraction";
    case simb::kQE                            : return "QE";
    case simb::kRes                           : return "Res";
    case simb::kDIS		                        : return "DIS		 ";
    case simb::kCoh		                        : return "Coh		 ";
    case simb::kCohElastic                    : return "CohElastic";
    case simb::kElectronScattering            : return "ElectronScattering";
    case simb::kIMDAnnihilation               : return "IMDAnnihilation";
    case simb::kInverseBetaDecay              : return "InverseBetaDecay";
    case simb::kGlashowResonance              : return "GlashowResonance";
    case simb::kAMNuGamma                     : return "AMNuGamma";
    case simb::kMEC                           : return "MEC";
    case simb::kDiffractive                   : return "Diffractive";
    case simb::kEM                            : return "EM";
    case simb::kWeakMix                       : return "WeakMix";
    case simb::kNuanceOffset                  : return "NuanceOffset";
    case simb::kCCQE                          : return "CCQE";
    case simb::kNCQE                          : return "NCQE";
    case simb::kResCCNuProtonPiPlus           : return "ResCCNuProtonPiPlus";
    case simb::kResCCNuNeutronPi0             : return "ResCCNuNeutronPi0";
    case simb::kResCCNuNeutronPiPlus          : return "ResCCNuNeutronPiPlus";
    case simb::kResNCNuProtonPi0              : return "ResNCNuProtonPi0";
    case simb::kResNCNuProtonPiPlus           : return "ResNCNuProtonPiPlus";
    case simb::kResNCNuNeutronPi0             : return "ResNCNuNeutronPi0";
    case simb::kResNCNuNeutronPiMinus         : return "ResNCNuNeutronPiMinus";
    case simb::kResCCNuBarNeutronPiMinus      : return "ResCCNuBarNeutronPiMinus";
    case simb::kResCCNuBarProtonPi0           : return "ResCCNuBarProtonPi0";
    case simb::kResCCNuBarProtonPiMinus       : return "ResCCNuBarProtonPiMinus";
    case simb::kResNCNuBarProtonPi0           : return "ResNCNuBarProtonPi0";
    case simb::kResNCNuBarProtonPiPlus        : return "ResNCNuBarProtonPiPlus";
    case simb::kResNCNuBarNeutronPi0          : return "ResNCNuBarNeutronPi0";
    case simb::kResNCNuBarNeutronPiMinus      : return "ResNCNuBarNeutronPiMinus";
    case simb::kResCCNuDeltaPlusPiPlus        : return "ResCCNuDeltaPlusPiPlus";
    case simb::kResCCNuDelta2PlusPiMinus      : return "ResCCNuDelta2PlusPiMinus";
    case simb::kResCCNuBarDelta0PiMinus       : return "ResCCNuBarDelta0PiMinus";
    case simb::kResCCNuBarDeltaMinusPiPlus    : return "ResCCNuBarDeltaMinusPiPlus";
    case simb::kResCCNuProtonRhoPlus          : return "ResCCNuProtonRhoPlus";
    case simb::kResCCNuNeutronRhoPlus         : return "ResCCNuNeutronRhoPlus";
    case simb::kResCCNuBarNeutronRhoMinus     : return "ResCCNuBarNeutronRhoMinus";
    case simb::kResCCNuBarNeutronRho0         : return "ResCCNuBarNeutronRho0";
    case simb::kResCCNuSigmaPlusKaonPlus      : return "ResCCNuSigmaPlusKaonPlus";
    case simb::kResCCNuSigmaPlusKaon0         : return "ResCCNuSigmaPlusKaon0";
    case simb::kResCCNuBarSigmaMinusKaon0     : return "ResCCNuBarSigmaMinusKaon0";
    case simb::kResCCNuBarSigma0Kaon0         : return "ResCCNuBarSigma0Kaon0";
    case simb::kResCCNuProtonEta              : return "ResCCNuProtonEta";
    case simb::kResCCNuBarNeutronEta          : return "ResCCNuBarNeutronEta";
    case simb::kResCCNuKaonPlusLambda0        : return "ResCCNuKaonPlusLambda0";
    case simb::kResCCNuBarKaon0Lambda0        : return "ResCCNuBarKaon0Lambda0";
    case simb::kResCCNuProtonPiPlusPiMinus    : return "ResCCNuProtonPiPlusPiMinus";
    case simb::kResCCNuProtonPi0Pi0           : return "ResCCNuProtonPi0Pi0";
    case simb::kResCCNuBarNeutronPiPlusPiMinus: return "ResCCNuBarNeutronPiPlusPiMinus";
    case simb::kResCCNuBarNeutronPi0Pi0       : return "ResCCNuBarNeutronPi0Pi0";
    case simb::kResCCNuBarProtonPi0Pi0        : return "ResCCNuBarProtonPi0Pi0";
    case simb::kCCDIS                         : return "CCDIS";
    case simb::kNCDIS                         : return "NCDIS";
    case simb::kUnUsed1                       : return "UnUsed1";
    case simb::kUnUsed2                       : return "UnUsed2";
    case simb::kCCQEHyperon                   : return "CCQEHyperon";
    case simb::kNCCOH                         : return "NCCOH";
    case simb::kCCCOH                         : return "CCCOH";
    case simb::kNuElectronElastic             : return "NuElectronElastic";
    case simb::kInverseMuDecay                : return "InverseMuDecay";
  }; 
  return "";
}

template<>
void GalleryRecordComposer::composeObject(const simb::MCNeutrino& neutrino, JsonObject& jnu)
{
  JsonObject nu; composeObject(neutrino.Nu(),nu);  jnu.add("nu",nu);
  JsonObject lp; composeObject(neutrino.Lepton(),lp);  jnu.add("lepton",lp);
  switch(neutrino.CCNC()) {
    case simb::kCC:  jnu.add("CCNC","CC"); break;
    case simb::kNC:  jnu.add("CCNC","NC"); break;
    default: jnu.add("CCNC","Unknown");
  }

  jnu.add("mode",lookupmode(neutrino.Mode()));
  jnu.add("interactiontype",lookupmode(neutrino.InteractionType()));
  jnu.add("targetPdg",neutrino.Target());
  jnu.add("hitNucleon",neutrino.HitNuc());
  jnu.add("hitQuark",neutrino.HitQuark());
  jnu.add("W",neutrino.W());
  jnu.add("X",neutrino.X());
  jnu.add("Y",neutrino.Y());
  jnu.add("Q2",neutrino.QSqr());
  if(neutrino.Nu().TrackId()>std::numeric_limits<int>::min()) {
    jnu.add("Pt",neutrino.Pt());         // Derived; needs library to see.
    jnu.add("Theta",neutrino.Theta());
  }
}


template<>
void GalleryRecordComposer::composeObject(const simb::GTruth& truth, JsonObject& jobj)
{
  jobj.add("fGint"       , truth.fGint       ); ///< interaction code
  jobj.add("fGscatter"   , truth.fGscatter   ); ///< neutrino scattering code
  jobj.add("fweight"     , truth.fweight     ); ///< event interaction weight (genie internal)
  jobj.add("fprobability", truth.fprobability); ///< interaction probability
  jobj.add("fXsec"       , truth.fXsec       ); ///< cross section of interaction
  jobj.add("fDiffXsec"   , truth.fDiffXsec   ); ///< differential cross section of interaction
  jobj.add("fNumPiPlus"  , truth.fNumPiPlus  ); ///< number of pi pluses in the final state
  jobj.add("fNumPiMinus" , truth.fNumPiMinus ); ///< number of pi minuses in the final state
  jobj.add("fNumPi0"     , truth.fNumPi0     ); ///< number of pi0 in the final state
  jobj.add("fNumProton"  , truth.fNumProton  ); ///< number of protons in the final state
  jobj.add("fNumNeutron" , truth.fNumNeutron ); ///< number of neutrons in the final state
  jobj.add("fIsCharm"    , truth.fIsCharm    ); ///< did the interaction produce a charmed hadron
  jobj.add("fResNum"     , truth.fResNum     ); ///< resonance number
  jobj.add("fgQ2"        , truth.fgQ2        );
  jobj.add("fgq2"        , truth.fgq2        );
  jobj.add("fgW"         , truth.fgW         );
  jobj.add("fgT"         , truth.fgT         );
  jobj.add("fgX"         , truth.fgX         );
  jobj.add("fgY"         , truth.fgY         );
  jobj.add("fIsSeaQuark" , truth.fIsSeaQuark );
  jobj.add("ftgtZ"       , truth.ftgtZ       );
  jobj.add("ftgtA"       , truth.ftgtA       );
  jobj.add("ftgtPDG"     , truth.ftgtPDG     ); ///< Target Nucleous(?) PDG
  jobj.add("fProbePDG"   , truth.fProbePDG   );
  jobj.add("fFShadSystP4", mom_to_json(truth.fFShadSystP4));
  jobj.add("fHitNucP4"   , mom_to_json(truth.fHitNucP4   ));
  jobj.add("fProbeP4"    , mom_to_json(truth.fProbeP4    ));
  jobj.add("fVertex"     , pos_to_json(truth.fVertex     ));


}

template<>
void GalleryRecordComposer::composeObject(const simb::MCTruth& truth, JsonObject& jobj)
{
  switch(truth.Origin()) {
    case simb::kBeamNeutrino:       jobj.add("origin","kBeamNeutrino"); break;
    case simb::kCosmicRay:          jobj.add("origin","kBeamNeutrino"); break;
    case simb::kSuperNovaNeutrino:  jobj.add("origin","kSuperNovaNeutrino"); break;
    case simb::kSingleParticle:     jobj.add("origin","kSingleParticle"); break;
    default: jobj.add("origin","Unknown");
  }

  JsonObject jnu;
  composeObject(truth.GetNeutrino(),jnu);
  jobj.add("neutrino",jnu);
    
    
  JsonArray jparticles;
  for(int i=0;i<truth.NParticles();i++) {
    JsonObject jpart;
    composeObject(truth.GetParticle(i),jpart);
    jparticles.add(jpart);
  }
  jobj.add("particles",jparticles);
}




struct GalleryAssociationHelper {
  // Provides a series of maps:
  // ProductID 1 -> ProductID 2 -> key 1 -> JsonArray(of key2)
  // used to create json objects like this:
  // keyname 1 object 0 maps to keyname2 objects 1,3 and 5.
  // key1name: { key2name: { 0: [1,3,5] }}

  typedef std::map<int,JsonArray> assn_3_t;
  typedef std::map<art::ProductID,assn_3_t> assn_2_t;
  typedef std::map<art::ProductID,assn_2_t> assn_1_t;

  assn_1_t _assn_1;
  assn_1_t::iterator _assn_1_itr;
  assn_2_t::iterator _assn_2_itr;
  assn_3_t::iterator _assn_3_itr;
  
  GalleryAssociationHelper() : _assn_1_itr(_assn_1.end()) {};

  void add(art::ProductID const& id1, size_t key1, art::ProductID const& id2, size_t key2)
  {
    // Efficient adding to my map of maps of maps of arrays.  Optimize on the last call to this function 
    // (stored in the _itr members) is the same as the previous call.
    // Uses maps for efficient storage. 
    // Assn3 COULD be done as a vector of JsonArrays, but with dynamic resizing I'm not convinced it's faster.
    if((_assn_1_itr == _assn_1.end()) || (_assn_1_itr->first!=id1)) {
      _assn_1_itr = _assn_1.find(id1);
      if(_assn_1_itr == _assn_1.end()) {
        _assn_1_itr = (_assn_1.insert(assn_1_t::value_type(id1,assn_2_t()))).first; // insert returns itr,bool
        _assn_2_itr = _assn_1_itr->second.end(); // reset itr 2
      }
    }
    // the _assn_1_itr now points correctly.
    assn_2_t& assn_2 = _assn_1_itr->second;
    
    if((_assn_2_itr == assn_2.end()) || (_assn_2_itr->first!=id2)) {
      _assn_2_itr = assn_2.find(id2);
      if(_assn_2_itr == assn_2.end()) {
        _assn_2_itr = (assn_2.insert(assn_2_t::value_type(id2,assn_3_t()))).first; // insert returns itr,bool
        _assn_3_itr = _assn_2_itr->second.end(); // reset itr 3
      }
    }
    
    // _assn_2_itr is now correct.
    assn_3_t& assn_3 = _assn_2_itr->second;
    
    if((_assn_3_itr == assn_3.end()) || (_assn_3_itr->first!=key1)) {
      _assn_3_itr = assn_3.find(key1);
      if(_assn_3_itr == assn_3.end()) {
        _assn_3_itr = (assn_3.insert(assn_3_t::value_type(key1,JsonArray()))).first; // insert returns itr,bool
      }
    }
     
    // _assn_3_itr is now correct
    _assn_3_itr->second.add(key2); // add to jsonarray
    // std::cout << " " << _assn_3_itr->second.length() << std::endl;
    
  } 
  
  void output(gallery::Event& event, JsonObject& assns) 
  {  
    for(auto& itr1: _assn_1) {
      JsonObject j1;
      const art::BranchDescription* desc1 = event.dataGetterHelper()->branchMapReader().productToBranch(itr1.first);
      std::string name1 = stripdots(desc1->branchName());
      std::cout << name1 << std::endl;
      
      for(auto& itr2: itr1.second) {
        JsonObject j2;
        const art::BranchDescription* desc2 = event.dataGetterHelper()->branchMapReader().productToBranch(itr2.first);
        std::string name2 = stripdots(desc2->branchName());
        std::cout << "\t" << name2 << std::endl;
        
        
        for(auto& itr3: itr2.second) {
          j2.add(std::to_string(itr3.first),itr3.second);
        }
        
        j1.add(name2,j2);
      }
      
      assns.add(name1,j1);
    }
    
  }
};


template<typename A, typename B>
void GalleryRecordComposer::composeAssociation()
{
  typedef art::Assns<A,B> assn_t;

  for(auto product: findByType<assn_t>(fEvent->getTTree())) {
    gallery::Handle< assn_t > assnhandle;
    {boost::mutex::scoped_lock b(fGalleryLock); fEvent->getByLabel(product.second,assnhandle);}
    if(assnhandle->size()>0) {
      // Add a->b and b->a.  Do seperately in order to keep the cached iterators efficient.
      for(const auto& assnpair: *assnhandle) {
        // debugging only
        // const art::BranchDescription* desc1 = fEvent->dataGetterHelper()->branchMapReader().productToBranch( assnpair.first.id());
        // std::string name1 = stripdots(desc1->branchName());
        // const art::BranchDescription* desc2 = fEvent->dataGetterHelper()->branchMapReader().productToBranch( assnpair.second.id());
        // std::string name2 = stripdots(desc2->branchName());
        // printf("%20s %5d  %20s %5d",name1.c_str(),assnpair.first.key(),name2.c_str(),assnpair.second.key());
        fAssnHelper->add( assnpair.first.id(), assnpair.first.key(), assnpair.second.id(), assnpair.second.key());
      }
      for(const auto& assnpair: *assnhandle)
        fAssnHelper->add( assnpair.second.id(), assnpair.second.key(), assnpair.first.id(), assnpair.first.key());
    }
  }
}




  // Some wonky stuff to help me do template combinatorics. See:https://stackoverflow.com/a/44298335/2596881
template <class T> struct tag { };
template <class... Ts> struct type_list { };

template<typename A, typename B>
void foo(GalleryRecordComposer& c, tag<A>, tag<B> ) {
  c.composeAssociation<A,B>();
}

// This hack keeps me from looking at types association<a,a> which are apparemently
// forbidden by the ART code
template<typename A>
void foo(GalleryRecordComposer& c, tag<A>, tag<A> ) {
  // std::cout << "Avoiding duplicate types" << std::endl;
}


template <class F, class... Ts>
void for_each(GalleryRecordComposer& c,F f, type_list<Ts...>) {
    using swallow = int[];
    (void)swallow{0, (void(f(c,tag<Ts>{})), 0)...};
}

template <class TL, class X>
struct Inner {
    template <class Y>
    void operator()(GalleryRecordComposer& c, tag<Y> ) {
        foo(c,tag<X>{}, tag<Y>{} );
    }
};

template <class TL>
struct Outer {
    template <class X>
    void operator()(GalleryRecordComposer& c, tag<X> ){
        for_each(c,Inner<TL, X>{}, TL{});
    }
};



void GalleryRecordComposer::composeAssociations()
{
  TimeReporter timer("Associations");
    
  fAssnHelper.reset(new GalleryAssociationHelper());
  JsonObject assns;


  // Variadic template magic!
  // The helper code above sorts the lines below into doing all combination
  // of data products in this list, looking for Assns<A,B> and Assns<B,A> for each pair.

  if( std::string::npos != fOptions.find("_ALLASSNS_")) {
    // Compose all associations, using all types I know of.
    using association_types = type_list<
        simb::MCParticle,
        simb::MCTruth,
        simb::GTruth,
        raw::RawDigit,
        recob::Wire,
        recob::Hit,
        recob::Cluster,
        recob::Shower,
        recob::SpacePoint,
        recob::Track,
        recob::Shower,
        recob::PFParticle,
        recob::OpHit,
        recob::OpFlash
      >;
    for_each(*this,Outer<association_types>{}, association_types{});
  } else {
    // That association list is just too much. Why don't we only use the ones we know to be useful?
    using association_types1 = type_list<
        simb::MCParticle,
        simb::MCTruth,
        simb::GTruth
      >;
    for_each(*this,Outer<association_types1>{}, association_types1{});

    using association_types2 = type_list<
        recob::Cluster,
        recob::Hit
      >;
    for_each(*this,Outer<association_types2>{}, association_types2{});

    using association_types3 = type_list<
        recob::PFParticle,
        recob::Shower,
        recob::Track        
      >;
    for_each(*this,Outer<association_types3>{}, association_types3{});
  }
  
  // composeAssociation<anab::Calorimetry,recob::Track>();
  // composeAssociation<anab::CosmicTag,recob::Hit>();
  // composeAssociation<anab::CosmicTag,recob::PFParticle>();
  // composeAssociation<anab::CosmicTag,recob::Track>();
  // composeAssociation<anab::ParticleID,recob::Track>();
  // composeAssociation<anab::T0,recob::Track>();
  // composeAssociation<raw::RawDigit,recob::Hit>();
  // composeAssociation<raw::RawDigit,recob::Wire>();
  // composeAssociation<recob::Cluster,recob::EndPoint2D>();
  // composeAssociation<recob::Cluster,recob::Hit>();
  // composeAssociation<recob::Cluster,recob::PFParticle>();
  // composeAssociation<recob::Cluster,recob::Shower>();
  // composeAssociation<recob::Cluster,recob::Vertex>();
  // composeAssociation<recob::Hit,recob::Seed>();
  // composeAssociation<recob::Hit,recob::Shower>();
  // composeAssociation<recob::Hit,recob::SpacePoint>();
  // composeAssociation<recob::Hit,recob::Track>();
  // composeAssociation<recob::Hit,recob::Wire>();
  // composeAssociation<recob::OpFlash,recob::OpHit>();
  // composeAssociation<recob::PFParticle,recob::Seed>();
  // composeAssociation<recob::PFParticle,recob::Shower>();
  // composeAssociation<recob::PFParticle,recob::SpacePoint>();
  // composeAssociation<recob::PFParticle,recob::Track>();
  // composeAssociation<recob::PFParticle,recob::Vertex>();
  // composeAssociation<recob::SpacePoint,recob::Track>();
  // composeAssociation<recob::Track,recob::Vertex>();
  // composeAssociation<simb::GTruth,simb::MCTruth>();
  // // composeAssociation<simb::MCFlux,simb::MCTruth>();
  // composeAssociation<simb::MCParticle,simb::MCTruth>();

  // Read out the association objects.
  fAssnHelper->output(*fEvent,assns);
  
  cout << "Association total size: " << assns.str().length() << std::endl;
  {
    boost::mutex::scoped_lock lck(fOutputMutex);
    fOutput.add("associations",assns);
    fStats.add("Associations",timer.t.Count());
    
  }
}


void GalleryRecordComposer::compose()
{
  TimeReporter timer("TOTAL");
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

  composeObjectsVector< std::vector<recob::SpacePoint> >("spacepoints", fOutput );
  composeObjectsVector< std::vector<recob::Cluster   > >("clusters"   , fOutput );
  composeObjectsVector< std::vector<recob::Track     > >("tracks"     , fOutput );
  composeObjectsVector< std::vector<recob::Shower    > >("showers"    , fOutput );
  composeObjectsVector< std::vector<recob::EndPoint2D> >("endpoint2d" , fOutput );
  composeObjectsVector< std::vector<recob::PFParticle> >("pfparticles", fOutput );
  composeObjectsVector< std::vector<recob::OpFlash   > >("opflashes"  , fOutput );
  composeObjectsVector< std::vector<recob::OpHit     > >("ophits"     , fOutput );
  composeObjectsVector< std::vector<  raw::OpDetPulse> >("oppulses"   , fOutput );

  JsonObject mc;
  bool got_mc = false;
  got_mc |= composeObjectsVector< std::vector<simb::GTruth> >("gtruth", mc );
  got_mc |= composeObjectsVector< std::vector<simb::MCTruth> >("mctruth", mc );
  got_mc |= composeObjectsVector< std::vector<simb::MCParticle> >("particles", mc );
  if(got_mc) {
    boost::mutex::scoped_lock lck(fOutputMutex);
    fOutput.add("mc",mc);    
  }
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
  timer.addto(fStats);
  fOutput.add("stats",fStats);
  
  
}





