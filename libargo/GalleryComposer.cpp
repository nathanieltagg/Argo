#include "GalleryComposer.h"
#include "TimeReporter.h"

#include "gallery/Event.h"

#include <TH1D.h>

// Data objects
#include "canvas/Persistency/Provenance/EventAuxiliary.h"
#include "canvas/Persistency/Common/Assns.h"
#include "lardataobj/RawData/TriggerData.h"
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

#include "json_tools.h"
#include "MakePng.h"
#include "EncodedTileMaker.h"
#include "RootToJson.h"
#include "GetSloMonDB.h"
#include "wireOfChannel.h"
#include "waveform_tools.h"
#include "DeadChannelMap.h"
#include "CoherentNoiseFilter.h"

#include "boost/thread/thread.hpp"
#include "boost/thread/mutex.hpp"
#include "boost/thread/shared_mutex.hpp"
#include "boost/core/demangle.hpp"

#include <signal.h>
#include <iostream>
// Utility functions:

using nlohmann::json;
using std::vector;
using std::string;
using std::endl;
using std::cout;

boost::mutex global_gallery_mutex;

std::string stripdots(const std::string& s)
{
  std::string out = s;
  size_t pos;
  while((pos = out.find('.')) != std::string::npos)  out.erase(pos, 1);
  return out;
}


GalleryComposer::GalleryComposer() 
  : m_stats(nlohmann::json::object())
  , m_Event(nullptr)
{
    std::cout << "GalleryComposer ctor" << std::endl; 

}

GalleryComposer::~GalleryComposer() 
  // : m_Event(nullptr)
  // , m_stats(nlohmann::json::object())
{
    std::cout << "GalleryComposer dtor" << std::endl; 
    // std::cout << "m_Event:" << ((m_Event)?"set":"unset") << std::endl; 
}

void GalleryComposer::initialize()
{
  // std::cout << *m_config << std::endl;
  m_CacheStoragePath  = m_config->value("CacheStoragePath", std::string("../datacache"));
  m_CacheStorageUrl   = m_config->value("CacheStorageUrl",  std::string("datacache"));
  m_WorkingSuffix     = m_config->value("WorkingSuffix",    "working");
  m_FinalSuffix       = m_config->value("FinalSuffix",      "event");
  m_CreateSubdirCache = m_config->value("CreateSubdirCache" ,true);
  
}

template<typename T>
vector<std::pair<string,art::InputTag>>  GalleryComposer::findByType(TTree* tree)
{
  // First, have we initialized our branch list for quick access?
  if(m_BranchNames.size()==0) {
    assert(tree);
    TObjArray* list = tree->GetListOfBranches();
    assert(list);
    for(int i=0;i<list->GetEntriesFast();i++) {
      TObject* o = list->At(i);
      TBranch* br = dynamic_cast<TBranch*>(o);
      std::string found = br->GetName();
  
      // Does it end with '.'?
      string::size_type p3 = found.find_last_of('.'); 
      if(p3!=found.length()-1 || p3==0) continue;
      
      m_BranchNames.push_back(found);
    }
    std::sort(m_BranchNames.begin(),m_BranchNames.end());
  }

  vector<std::pair<string,art::InputTag>> retval;
  // Leaf names for std::vector<recob::Wire> get renamed
  // to the art version of "recob::Wires" by this. 
  std::string pattern = art::TypeID(typeid(T)).friendlyClassName() + '_';
  // std::cout << "Looking for leaf of type " << pattern << "label_instance_process." << endl;

  // Look through every branch name.
  
  // We're looking for:
  // OBJ_LABEL_INSTANCE_PROCESSNAME.obj_
  // Where OBJ is something like "recob::Wires"
  // Where LABEL is something like "pandora"
  // INSTANCE is usually (always?) blank
  // Where PROCESSNAME is something like "McRecoAprStage1"
  // json br(m_BranchNames);
  // std::cout << "branches: " << br.dump(2) << std::endl;
  auto p1 = std::lower_bound(m_BranchNames.begin(),m_BranchNames.end(),pattern);
  for(auto p=p1; p!=m_BranchNames.end(); p++) {
    const std::string& found = *p;
    // std::cout << "Compare to " << found << std::endl;
    // Does it begin with our object type?
    if(found.find(pattern)!=0) continue; //return retval; // finished

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
    // std::cout << "Found " << found << ":" << tag << std::endl;
    retval.push_back( make_pair( found, tag ));
    
  }
  return retval;
}


template<typename V>
bool GalleryComposer::composeObjectsVector(const std::string& output_name, json& output)
{
  json reco_list;  // Place to store all objects of type (e.g. all spacepoint lists.)
  TimeReporter cov_timer(output_name);
 
  progress_made("Composing "+output_name);  
  
  int found = 0;
  auto products = findByType<V>(m_Event->getTTree());  // Get a list of all products matching template
  for(auto product: products) {
    // std::cout << "Looking at " << boost::core::demangle( typeid(V).name() ) <<" object " << product.first << std::endl;

    TimeReporter timer(product.first);    // This object creates statistics on how long this reco took.
    gallery::Handle<V> handle;            

    { // Create a scope
      boost::mutex::scoped_lock b(m_gallery_mutex); // Mutex thread lock exists within brace scope
      boost::mutex::scoped_lock g(global_gallery_mutex);      
      m_Event->getByLabel(product.second,handle); // Get data from the file
    }
    if(!handle.isValid()) {
      std::cerr << "No data!" << std::endl;
      continue;
    }
    found++;
    
    json jlist = json::array();    // List of objects (e.g. Kalman Spacepoints)
    for(const auto& item: *handle) {
      // item is a specific object (e.g. SpacePoint), jitem is the objected moved to JSON (one spacepoint)
      json jitem;
      composeObject(item,jitem);
      jlist.push_back(jitem); // Add to list
    }
    reco_list[stripdots(product.first)] = jlist; // Add this list of spacepoints to the list of reco objects
    //timer.addto(m_stats);    // Naw, don't need that level of ganularity. Needs mutex.
  }
  {
    boost::mutex::scoped_lock lck(m_output_mutex);  // Scope a lock around the global output object
    output[output_name] = reco_list;                // Add the output.
    cov_timer.addto(m_stats);  
  }  
  return(found>0);
}
  
template<typename T>
void GalleryComposer::composeObject(const T&, json& out)
{
  out["Unimplimented"] = json();
}






void GalleryComposer::composeHeaderData()
{
  TimeReporter ttt("header");
  // Header data. Alas, this is the stuff that's nearly impossible to get!
  json header;
  art::EventAuxiliary const& aux = m_Event->eventAuxiliary();

  header["run"]=aux.id().run();
  header["subrun"]=aux.id().subRun();
  header["event"]=aux.id().event();
  // Todo: build these into a proper javascript-style timestamp.
  double tlow = aux.time().timeLow();
  double thigh = aux.time().timeHigh();
  header["timeLow"]=tlow;
  header["timeHigh"]=thigh;
  header["isRealData"]=aux.isRealData();
  header["experimentType"]=aux.experimentType();


  header["seconds"] = thigh;
  header["daqTime"] = thigh*1000;

  m_event_time = thigh*1000; // ms
  header["eventTime"] = m_event_time; // in ms.

  // double swizzler_time = ftr.getF("raw::DAQHeader_daq__Swizzler.obj.fTime");
  // if(swizzler_time>0) {
  //   // It's stored as a time_t.  Shift right 32 bits = divide by this crazy number. Then multiply by 1000 to get ms.
  //   event_time = swizzler_time/4.294967296e+09*1000.;
  // }
  // header["swizzlertime"] = event_time;
  //
  json trigger;
  {
    auto products = findByType< vector<raw::Trigger> >(m_Event->getTTree());
    for(auto product: products) {

      // std::cout << "Looking at " << boost::core::demangle( typeid(raw::Trigger).name() ) <<" object " << product.first << std::endl;
      gallery::Handle< vector<raw::Trigger> > handle;
      {
        boost::mutex::scoped_lock b(m_gallery_mutex); 
        boost::mutex::scoped_lock g(global_gallery_mutex);      
        m_Event->getByLabel(product.second,handle);
      }
      if(!handle.isValid()) { continue;  }

      // cout << "trigs: " << handle->size() << std::endl;
      for(const raw::Trigger& trg: *handle) {
        // cout << "triggerword " << trg.TriggerBits() << std::endl;
        trigger["triggerword"] = trg.TriggerBits();
      }
    }
  }

  // The swtrigger data object is in uboone,
  // {
  //   auto products = findByType< vector<raw::ubdaqSoftwareTriggerData> >(m_Event->getTTree());
  //   for(auto product: products) {
  //
  //     std::cout << "Looking at SW Trigger object " << product.first << std::endl;
  //     gallery::Handle< vector<raw::ubdaqSoftwareTriggerData> > handle;
  //     {boost::mutex::scoped_lock b(m_gallery_mutex); m_Event->getByLabel(product.second,handle);}
  //     if(!handle.isValid()) { continue;  }
  //     json sw_triggers;
  //     cout << "trigs: " << handle->size() << std::endl;
  //     for(const raw::ubdaqSoftwareTriggerData& swtrig: *handle) {
  //       for(int i = 0; i< swtrig.getNumberOfAlgorithms(); i++) {
  //         if(swtrig.getPass(i)) sw_triggers.push_back(swtrig.getTriggerAlgorithm(i));
  //       }
  //     }
  //     trigger["sw_triggers"] = sw_triggers;
  //   }
  // }
  header["trigger"] = trigger;

  {
    boost::mutex::scoped_lock lck(m_output_mutex);
    m_result["header"] = header;
  }
  ttt.addto(m_stats);
}




void GalleryComposer::composeHits()
{
  ///
  /// Obsolete: hit histograms are burdensome and awkward in new system, and don't really buy me anything since
  /// I stopped using them ages ago. The ZoomControl still references them, but I think I'm better off doing p
  typedef vector<recob::Hit> current_type_t;
  auto products = findByType<current_type_t>(m_Event->getTTree());
  TimeReporter toptimer("hits");

  json reco_list;
  json hist_list;
  for(auto product: products) {
    // std::cout << "Looking at " << boost::core::demangle( typeid(current_type_t).name() )  <<" object " << product.first << std::endl;
    TimeReporter timer(product.first);

    gallery::Handle< current_type_t > handle;
    {boost::mutex::scoped_lock b(m_gallery_mutex);       boost::mutex::scoped_lock g(global_gallery_mutex);   m_Event->getByLabel(product.second,handle);}
    if(!handle.isValid()) {
      std::cerr << "No data!" << std::endl;
      continue;
    }
    
    json arr(json::array());
    // Hit histograms.
    TH1D timeProfile("timeProfile","timeProfile",960,0,9600);
    std::vector<TH1*> planeProfile;
    planeProfile.push_back(new TH1D("planeProfile0","planeProfile0",218,0,2398));
    planeProfile.push_back(new TH1D("planeProfile1","planeProfile1",218,0,2398));
    planeProfile.push_back(new TH1D("planeProfile2","planeProfile2",432,0,3456));

    for(const recob::Hit& hit: * handle) {
      json h;
      int wire = hit.WireID().Wire;
      int plane = hit.WireID().Plane;
      double q  = hit.Integral();
      double t  = hit.PeakTime();
      double t1 = hit.StartTick();
      double t2 = hit.EndTick();

      if(plane==2)timeProfile.Fill(t,q);
      if(plane>=0 && plane<3) planeProfile[plane]->Fill(wire,q);

      h["wire"] =   wire;
      h["plane"] =  plane;
      h["q"] =        jsontool::fixed(q,0)     ;
      h["t"] =        jsontool::fixed(t,1)     ;
      h["t1"] =       jsontool::fixed(t1,1)    ;
      h["t2"] =       jsontool::fixed(t2,1)    ;
      arr.push_back(h);
    }

    reco_list[stripdots(product.first)] = arr;

    json hists;
    hists["timeHist"] = TH1ToHistogram(&timeProfile);
    json jPlaneHists = json::array();
    jPlaneHists.push_back(TH1ToHistogram(planeProfile[0]));
    jPlaneHists.push_back(TH1ToHistogram(planeProfile[1]));
    jPlaneHists.push_back(TH1ToHistogram(planeProfile[2]));
    hists["planeHists"] = jPlaneHists;

    delete planeProfile[0];
    delete planeProfile[1];
    delete planeProfile[2];
    hist_list[stripdots(product.first)] = hists;
    //timer.addto(m_stats);
  }
  {
    boost::mutex::scoped_lock lck(m_output_mutex);

    toptimer.addto(m_stats);

    m_result["hits"] = reco_list;
    m_result["hit_hists"] = hist_list;
  }
  // std::cout << "Hits finishing" << std::endl;
}


// default template for vectors:
template<typename TT> 
void GalleryComposer::composeObject(const std::vector<TT>&v, nlohmann::json& out)
{
  out = json::array();
  for(auto item: v) {
    json j;
    composeObject(item,j);
    out.push_back(j);
  }
} 

template<>
void GalleryComposer::composeObject(const recob::Hit& hit, nlohmann::json& h)
{
  int wire = hit.WireID().Wire;
  int plane = hit.WireID().Plane;
  double q  = hit.Integral();
  double t  = hit.PeakTime();
  double t1 = hit.StartTick();
  double t2 = hit.EndTick();

  h["wire"] =   wire;
  h["plane"] =  plane;
  h["q"] =      jsontool::fixed(q,0)     ;
  h["t"] =      jsontool::fixed(t,1)     ;
  h["t1"] =     jsontool::fixed(t1,1)    ;
  h["t2"] =     jsontool::fixed(t2,1)    ;
} 


template<>
void GalleryComposer::composeObject(const recob::SpacePoint& sp, json& jsp)
{
  // cout << "Composing spacepoint " << sp.ID() << std::endl;
  jsp["id"    ] = sp.ID()   ;
  jsp["chisq" ] = jsontool::fixed(sp.Chisq(),1);
  json xyz = json::array();
  xyz.push_back(jsontool::fixed(sp.XYZ()[0],1));
  xyz.push_back(jsontool::fixed(sp.XYZ()[1],1));
  xyz.push_back(jsontool::fixed(sp.XYZ()[2],1));

  // Error matrix isn't used and takes up lots of space.
  // json errXyz;
  // errXyz[sp.ErrXYZ()[0]);
  // errXyz.push_back(sp.ErrXYZ()[1]);
  // errXyz.push_back(sp.ErrXYZ()[2]);
  // errXyz.push_back(sp.ErrXYZ()[3]);
  // errXyz.push_back(sp.ErrXYZ()[4]);
  // errXyz.push_back(sp.ErrXYZ()[5]);

  jsp["xyz"] = xyz;
  // jsp["errXyz"] = errXyz;
}

template<>
void GalleryComposer::composeObject(const recob::Track& track, json& jtrk)
{
  jtrk["id"    ] = track.ID();
  jtrk["chi2"    ] = track.Chi2();
  jtrk["ndof"    ] = track.Ndof();
  jtrk["particleId"    ] = track.ParticleId();
  jtrk["theta"    ] = track.Theta();
  jtrk["phi"    ] = track.Phi();

  const recob::TrackTrajectory& traj = track.Trajectory();
  json jpoints = json::array();
  size_t first_point = traj.FirstValidPoint();
  size_t last_point  = traj.LastValidPoint();
  // size_t npoints = traj.NPoints();
  // cout << " Points: " << npoints << " first: " << first_point << " last: " << last_point << std::endl;
  for(size_t i = first_point; i<= last_point; i++) {
    // cout << " constructing point " << i << " next is " <<  traj.NextValidPoint(i) << std::endl;
    if(!traj.HasPoint(i)) continue;
    json jpoint;
    const auto& xyz = traj.LocationAtPoint(i);
    const auto& mom = traj.MomentumVectorAtPoint(i);
    double p = mom.R();

    jpoint["x"] = jsontool::fixed(xyz.x(),2);
    jpoint["y"] = jsontool::fixed(xyz.y(),2);
    jpoint["z"] = jsontool::fixed(xyz.z(),2);
    if((i==first_point) || (i==last_point)) { // save space by not including direction.  This kills BEZIER tracks!
      recob::Trajectory::Vector_t dir;
      if(p>0) dir = mom/p;
      else    dir = mom;
      jpoint["vx"] = jsontool::fixed(dir.x(),4);
      jpoint["vy"] = jsontool::fixed(dir.y(),4);
      jpoint["vz"] = jsontool::fixed(dir.z(),4);
    }
    jpoints.push_back(jpoint);
  }
  jtrk["points"] = jpoints;
}

template<>
void GalleryComposer::composeObject(const recob::Shower& shower, json& jshw)
{

  jshw["id"    ] = shower.ID();
  TVector3 const& xyz = shower.ShowerStart();
  json jstart;
  jstart["x"] =  xyz.x() ;
  jstart["y"] =  xyz.y() ;
  jstart["z"] =  xyz.z() ;
  jshw["start"] = jstart;

  TVector3 const& dir = shower.Direction();
  json jdir;
  jdir["x"] =  dir.x() ;
  jdir["y"] =  dir.y() ;
  jdir["z"] =  dir.z() ;
  jshw["dir"] = jdir;
  
  json jEnd;
  jEnd["x"] =  xyz.x() ;
  jEnd["y"] =  xyz.y() ;
  jEnd["z"] =  xyz.z() ;
  jshw["end"] = jEnd;


  jshw["bestPlane"] = shower.best_plane() ;
  jshw["Length"] =  shower.Length() ;

  jshw["totalEnergy"] = json(shower.Energy()); // Implicit Conversion from vector<double> to json
  jshw["dEdx"] = json(shower.dEdx()); // ditto
  jshw["totMIPEnergy"] = json(shower.MIPEnergy()); // ditto
}


template<>
void GalleryComposer::composeObject(const recob::PFParticle& p, json& jpf)
{
  jpf["self"    ] = p.Self()    ;
  jpf["pdg"     ] = p.PdgCode() ;
  jpf["parent"  ] = p.Parent()  ; 
  jpf["daughters"] =  json(p.Daughters()); // Implicit conversion vector<size_t> to json
}

template<>
void GalleryComposer::composeObject(const recob::OpFlash& flash, json& jflash)
{
  jflash["time"       ] = flash.Time()       ; 
  jflash["timeWidth"  ] = flash.TimeWidth()  ; 
  jflash["absTime"    ] = flash.AbsTime()    ; 
  jflash["yCenter"    ] = flash.YCenter()    ; 
  jflash["yWidth"     ] = flash.YWidth()     ; 
  jflash["zCenter"    ] = flash.ZCenter()    ; 
  jflash["zWidth"     ] = flash.ZWidth()     ; 
  jflash["onBeamTime" ] = flash.OnBeamTime() ; 
  jflash["inBeamFrame"] = flash.InBeamFrame(); 

  // Would have to pull it out one at a time. But I don't think I use this.
  //jflash["pePerOpDet"] =      json(*(tel_fPEperOpDet .get<vector<double> >(i)));
  jflash["totPe"] = flash.TotalPE();

  // auto-construct arrays; lots o' syntactic sugar here.
  jflash["wireCenter"] =      json(flash.WireCenters());
  jflash["wireWidths"] =      json(flash.WireWidths() );
}


template<>
void GalleryComposer::composeObject(const raw::OpDetPulse& pulse, json& jobj)
{
  jobj["opDetChan"] =  pulse.OpChannel();
  jobj["samples"] =  pulse.Samples();
  jobj["tdc"] =  pulse.FirstSample();
  jobj["frame"] =  pulse.PMTFrame();
  // In fact, this class is fundamentally broken: there is no const version of Waveform(), so the data is write-only! 
  // if(pulse.Samples() < 10000) {
    // jobj["waveform"] = json(pulse.Waveform());
  // }
}

template<>
void GalleryComposer::composeObject(const recob::OpHit& hit, json& jobj)
{
  jobj["opDetChan"     ] = hit.OpChannel();
  jobj["peakTime"      ] = 1e3*hit.PeakTime();
  jobj["width"         ] = hit.Width();
  jobj["area"          ] = hit.Area();
  jobj["amp"           ] = hit.Amplitude();
  jobj["pe"            ] = hit.PE();
  jobj["fastToTotal"   ] = hit.FastToTotal();
}

void GalleryComposer::composeCalAvailability()
{
  typedef vector<recob::Wire> current_type_t;
  auto products = findByType<current_type_t>(m_Event->getTTree());

  json reco_list;
  for(auto product: products) {
    std::string name = product.first;
    reco_list[stripdots(product.first)] = json();
  }
  {
    boost::mutex::scoped_lock lck(m_output_mutex);
    m_result["cal"] = reco_list;
  }
}

void GalleryComposer::composeWires()
{
  typedef vector<recob::Wire> current_type_t;
  auto products = findByType<current_type_t>(m_Event->getTTree());

  json reco_list;
  json reco_list2;

  for(auto product: products) {

    // std::cout << "Looking at " << boost::core::demangle( typeid(current_type_t).name() ) <<" object " << product.first << std::endl;
    TimeReporter timer(product.first);

    gallery::Handle< current_type_t > handle;
    {boost::mutex::scoped_lock b(m_gallery_mutex);       boost::mutex::scoped_lock g(global_gallery_mutex);       m_Event->getByLabel(product.second,handle);}
    if(!handle.isValid()) {
      std::cerr << "No data!" << std::endl;
      continue;
    }

    bool is_supernova = (product.second.label() == "sndaq");
    
    size_t nchannels = handle->size();
    if(nchannels<1) {
      // std::cout << "No entries in object;" << std::endl;
      continue;
    }

    json r;
    std::shared_ptr<wiremap_t> wireMap(new wiremap_t);
    std::shared_ptr<wiremap_t> noiseMap(new wiremap_t);
    
    size_t ntdc = handle->begin()->NSignal();
    // std::cout << " Channels: " << nchannels << " TDCs: " << ntdc << std::endl;
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
        
        for(int i = FirstTick ; i< EndTick; i++){
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
    // std::cout << "maxwire:" << nwire << " nwire:" << wireMap->size() << std::endl;
    // std::cout << "ntdc :" << ntdc << std::endl;
    int tilesize = m_request->value("tilesize",2400);
    // std::cout << "Doing tilesize" << tilesize << std::endl;
    
    MakeEncodedTileset(     r,
                            wireMap,
                            noiseMap,
                            nwire,
                            ntdc,
                            m_CacheStoragePath,
                            m_CacheStorageUrl,
                            tilesize,
                            false );

    reco_list[stripdots(product.first)] = r;


    {
      json r2;
      TimeReporter lowres_stats("time_to_make_lowres");
      MakeLowres( r2,
                     wireMap,
                     noiseMap,
                     nwire,
                     ntdc, m_CacheStoragePath, m_CacheStorageUrl, tilesize, false );
      reco_list2[stripdots(product.first)] = r2;
    }
    timer.addto(m_stats);
    

  }
  {
    boost::mutex::scoped_lock lck(m_output_mutex);

    m_result["cal"] = reco_list;
    m_result["cal_lowres"] = reco_list2;
  }
  // std::cout << "Wires finishing" << std::endl;
  
  
}

void GalleryComposer::composeRawAvailability()
{
  typedef vector<raw::RawDigit> current_type_t;
  auto products = findByType<current_type_t>(m_Event->getTTree());

  json reco_list;
  for(auto product: products) {
    reco_list[stripdots(product.first)] = json();
  }
  {
    boost::mutex::scoped_lock lck(m_output_mutex);
    m_result["raw"] = reco_list;
  }
  
}


void GalleryComposer::composeRaw()
{
  
  typedef vector<raw::RawDigit> current_type_t;
  auto products = findByType<current_type_t>(m_Event->getTTree());

  json reco_list;
  json reco_list2; // lowres

  for(auto product: products) {
  

    // std::cout << "Looking at " << boost::core::demangle( typeid(current_type_t).name() )  <<" object " << product.first << std::endl;
    TimeReporter timer(product.first);

    gallery::Handle< current_type_t > handle;
    {boost::mutex::scoped_lock b(m_gallery_mutex); boost::mutex::scoped_lock g(global_gallery_mutex);      m_Event->getByLabel(product.second,handle);}
    if(!handle.isValid()) {
      std::cerr << "No data!" << std::endl;
      continue;
    }

    size_t nchannels = handle->size();
    if(nchannels<1) {
      // std::cout << "No entries in object;" << std::endl;
      continue;
    }

    json jpedestals = json::array();
    std::shared_ptr<wiremap_t> wireMap(new wiremap_t);
    std::shared_ptr<wiremap_t> noiseMap(new wiremap_t);

    size_t ntdc = 0;

    for(const raw::RawDigit& rawdigit: *handle) {
      short pedestal = rawdigit.GetPedestal();
      int wire = rawdigit.Channel();
      if(pedestal<0) pedestal = 0; // Didn't read correctly.
      jpedestals.push_back(pedestal);

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
      // double rms = pedcomp.pedsig(); // auto-adjusted rms.

      for(size_t i =0; i< nsamp; i++) {
        waveform[i] -= ped;
      }
      waveform._status = gDeadChannelMap->status(wire);


      if(wireMap->size() <= wire) wireMap->resize(wire+1);
      (*wireMap)[wire] = waveform_ptr;
      ntdc = std::max(ntdc,rawdigit.NADC());
    }
    noiseMap->resize(wireMap->size());
    int nwire = wireMap->size();

    CoherentNoiseFilter(wireMap,noiseMap,nwire,ntdc);

    // Now we should have a semi-complete map.
    // std::cout << "nwire:" << nwire << std::endl;
    // std::cout << "ntdc :" << ntdc << std::endl;
    json r;
    int tilesize = m_request->value("tilesize",2400);
    MakeEncodedTileset(     r,
                            wireMap,
                            noiseMap,
                            nwire,
                            ntdc,
                            m_CacheStoragePath,
                            m_CacheStorageUrl,
                            tilesize,
                            true );

    reco_list[stripdots(product.first)] = r;

    {
      json r2;
      TimeReporter lowres_stats("time_to_make_lowres");
      MakeLowres( r2,
                     wireMap,
                     noiseMap,
                     nwire,
                     ntdc, m_CacheStoragePath, m_CacheStorageUrl, tilesize, false );
      reco_list2[stripdots(product.first)] = r2;
    }

    timer.addto(m_stats);
    break; // only 1 raw list.

  }
  {
    boost::mutex::scoped_lock lck(m_output_mutex);
    m_result["raw"] = reco_list;
    m_result["raw_lowres"] = reco_list2;
  }
  // std::cout << "RawDigits finishing" << std::endl;
  
}
//
//
int GalleryComposer::pointOffLine(const TLorentzVector& x0, const TLorentzVector& pv, const TLorentzVector& x, double tol)
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

json pos_to_json(const TLorentzVector& v)
{
  json j;
  j["x"] = v.X();
  j["y"] = v.Y();
  j["z"] = v.Z();
  j["t"] = v.T();
  return j;
}

json mom_to_json(const TLorentzVector& v)
{
  json j;
  j["px"] = v.X();
  j["py"] = v.Y();
  j["pz"] = v.Z();
  j["E"] = v.E();
  return j;
}

template<>
void GalleryComposer::composeObject(const simb::MCParticle& particle, json& jobj)
{
  if(particle.TrackId() == std::numeric_limits<int>::min()) return;
  jobj["ftrackId"     ] = particle.TrackId();
  jobj["fstatus"      ] = particle.StatusCode();
  jobj["fpdgCode"     ] = particle.PdgCode();
  jobj["fmother"      ] = particle.Mother();
  jobj["process"      ] = particle.Process();
  jobj["endProcess"   ] = particle.EndProcess();
  jobj["fmass"        ] = particle.Mass();
  jobj["weight"      ] = particle.Weight();
  jobj["rescatter"   ] = particle.Rescatter();

  // Trajectory. Make a copy so we can sparsify it.
  json jtraj = json::array();
  const simb::MCTrajectory& traj = particle.Trajectory();
  size_t n = traj.size();
  if(n==0) return;
  // simb::MCTrajectory my_traj(particle.Trajectory());
  // my_traj.Sparsify();
  // // cout << "Particles before sparsification: " << particle.Trajectory().size() << " after " << my_traj.size() << std::endl;
  //
  // for(auto pt: my_traj )
  // {
  //   json trajpoint;
  //   trajpoint["x"] =  jsontool::fixed(pt.first.X(),1);
  //   trajpoint["y"] =  jsontool::fixed(pt.first.Y(),1);
  //   trajpoint["z"] =  jsontool::fixed(pt.first.Z(),1);
  //   trajpoint["t"] =  jsontool::fixed(pt.first.T(),1);
  //   trajpoint["px"] = jsontool::fixed(pt.second.X(),4);
  //   trajpoint["py"] = jsontool::fixed(pt.second.Y(),4);
  //   trajpoint["pz"] = jsontool::fixed(pt.second.Z(),4);
  //   trajpoint["E" ] = jsontool::fixed(pt.second.T(),6);
  //   jtraj.push_back(trajpoint);
  // }
  // jobj["trajectory"] = jtraj;

  
  // My version of sparsification is more aggressive than the built-in version.
  TLorentzVector x_last  = (traj[0].first);
  TLorentzVector p_last  = (traj[0].second);
  size_t j  = 0;
  size_t n_saved = 0;
  for(const auto& pt: traj) {
    TLorentzVector x   = (pt.first);
    TLorentzVector p   = (pt.second);
    
    if(  j==0  // keep first point
      || j==n-1  // keep last point
      || pointOffLine(x_last,p_last,x,0.2)) // keep any point not on projected line within a 0.2 cm tolerance
    {
      // Keep this point.
      json trajpoint;
      
      trajpoint["x"] = jsontool::fixed(x.X(),1);
      trajpoint["y"] = jsontool::fixed(x.Y(),1);
      trajpoint["z"] = jsontool::fixed(x.Z(),1);
      trajpoint["t"] = jsontool::fixed(x.T(),1);
      trajpoint["px"] = jsontool::fixed(p.X(),4);
      trajpoint["py"] = jsontool::fixed(p.Y(),4);
      trajpoint["pz"] = jsontool::fixed(p.Z(),4);
      trajpoint["E" ] = jsontool::fixed(p.T(),6);
      jtraj.push_back(trajpoint); 
      x_last = x;
      p_last = p;
      n_saved++;
    }
    j++;
  }
  jobj["trajectory"] = jtraj;
  // std::cout << "Trajectory sparsification: before " << n << " after " << n_saved << std::endl;
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
void GalleryComposer::composeObject(const simb::MCNeutrino& neutrino, json& jnu)
{
  json nu; composeObject(neutrino.Nu(),nu);  jnu["nu"] = nu;
  json lp; composeObject(neutrino.Lepton(),lp);  jnu["lepton"] = lp;
  switch(neutrino.CCNC()) {
    case simb::kCC:  jnu["CCNC"] = "CC"; break;
    case simb::kNC:  jnu["CCNC"] = "NC"; break;
    default: jnu["CCNC"] = "Unknown";
  }

  jnu["mode"] = lookupmode(neutrino.Mode());
  jnu["interactiontype"] = lookupmode(neutrino.InteractionType());
  jnu["targetPdg"] = neutrino.Target();
  jnu["hitNucleon"] = neutrino.HitNuc();
  jnu["hitQuark"] = neutrino.HitQuark();
  jnu["W"] = neutrino.W();
  jnu["X"] = neutrino.X();
  jnu["Y"] = neutrino.Y();
  jnu["Q2"] = neutrino.QSqr();
  if(neutrino.Nu().TrackId()>std::numeric_limits<int>::min()) {
    jnu["Pt"] = neutrino.Pt();         // Derived; needs library to see.
    jnu["Theta"] = neutrino.Theta();
  }
}


template<>
void GalleryComposer::composeObject(const simb::GTruth& truth, json& jobj)
{
  jobj["fGint"       ] =  truth.fGint       ; ///< interaction code
  jobj["fGscatter"   ] =  truth.fGscatter   ; ///< neutrino scattering code
  jobj["fweight"     ] =  truth.fweight     ; ///< event interaction weight (genie internal
  jobj["fprobability"] =  truth.fprobability; ///< interaction probability
  jobj["fXsec"       ] =  truth.fXsec       ; ///< cross section of interaction
  jobj["fDiffXsec"   ] =  truth.fDiffXsec   ; ///< differential cross section of interaction
  jobj["fNumPiPlus"  ] =  truth.fNumPiPlus  ; ///< number of pi pluses in the final state
  jobj["fNumPiMinus" ] =  truth.fNumPiMinus ; ///< number of pi minuses in the final state
  jobj["fNumPi0"     ] =  truth.fNumPi0     ; ///< number of pi0 in the final state
  jobj["fNumProton"  ] =  truth.fNumProton  ; ///< number of protons in the final state
  jobj["fNumNeutron" ] =  truth.fNumNeutron ; ///< number of neutrons in the final state
  jobj["fIsCharm"    ] =  truth.fIsCharm    ; ///< did the interaction produce a charmed hadron
  jobj["fResNum"     ] =  truth.fResNum     ; ///< resonance number
  jobj["fgQ2"        ] =  truth.fgQ2        ;
  jobj["fgq2"        ] =  truth.fgq2        ;
  jobj["fgW"         ] =  truth.fgW         ;
  jobj["fgT"         ] =  truth.fgT         ;
  jobj["fgX"         ] =  truth.fgX         ;
  jobj["fgY"         ] =  truth.fgY         ;
  jobj["fIsSeaQuark" ] =  truth.fIsSeaQuark ;
  jobj["ftgtZ"       ] =  truth.ftgtZ       ;
  jobj["ftgtA"       ] =  truth.ftgtA       ;
  jobj["ftgtPDG"     ] =  truth.ftgtPDG     ; ///< Target Nucleous(? PDG
  jobj["fProbePDG"   ] =  truth.fProbePDG   ;
  jobj["fFShadSystP4"] =  mom_to_json(truth.fFShadSystP4);
  jobj["fHitNucP4"   ] =  mom_to_json(truth.fHitNucP4   );
  jobj["fProbeP4"    ] =  mom_to_json(truth.fProbeP4    );
  jobj["fVertex"     ] =  pos_to_json(truth.fVertex     );


}

template<>
void GalleryComposer::composeObject(const simb::MCTruth& truth, json& jobj)
{
  switch(truth.Origin()) {
    case simb::kBeamNeutrino:       jobj["origin"] = "kBeamNeutrino"; break;
    case simb::kCosmicRay:          jobj["origin"] = "kBeamNeutrino"; break;
    case simb::kSuperNovaNeutrino:  jobj["origin"] = "kSuperNovaNeutrino"; break;
    case simb::kSingleParticle:     jobj["origin"] = "kSingleParticle"; break;
    default: jobj["origin"] = "Unknown";
  }

  json jnu;
  composeObject(truth.GetNeutrino(),jnu);
  jobj["neutrino"] = jnu;
    
    
  json jparticles = json::array();
  for(int i=0;i<truth.NParticles();i++) {
    json jpart;
    composeObject(truth.GetParticle(i),jpart);
    jparticles.push_back(jpart);
  }
  jobj["particles"] = jparticles;
}



struct GalleryAssociationHelper {
  // Provides a series of maps:
  // ProductID 1 -> ProductID 2 -> key 1 -> json(of key2)
  // used to create json objects like this:
  // keyname 1 object 0 maps to keyname2 objects 1,3 and 5.
  // key1name: { key2name: { 0: [1,3,5] }}

  typedef std::map<int,json> assn_3_t;
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
    // Assn3 COULD be done as a vector of json arrays s, but with dynamic resizing I'm not convinced it's faster.
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
        _assn_3_itr = (assn_3.insert(assn_3_t::value_type(key1,json(json::array())))).first; // insert returns itr,bool
      }
    }
     
    // _assn_3_itr is now correct
    _assn_3_itr->second.push_back(key2); // add to jsonarray
    // std::cout << " " << _assn_3_itr->second.length() << std::endl;
    
  } 
  
  void output(gallery::Event& event, json& assns) 
  {  
    for(auto& itr1: _assn_1) {
      json j1;
      art::BranchDescription const& desc1 = event.getProductDescription(itr1.first);
      std::string name1 = stripdots(desc1.branchName());

      // std::cout << name1 << std::endl;
      
      for(auto& itr2: itr1.second) {
        json j2;
        
        art::BranchDescription const& desc2 = event.getProductDescription(itr2.first);
        std::string name2 = stripdots(desc2.branchName());

        // std::cout << "\t" << name2 << std::endl;
        
        
        for(auto& itr3: itr2.second) {
          j2[std::to_string(itr3.first)] = itr3.second;
        }
        
        j1[name2] = j2;
      }
      
      assns[name1] = j1;
    }
    
  }
};



template<typename A, typename B>
void GalleryComposer::composeAssociation()
{
  typedef art::Assns<A,B> assn_t;

  std::cout << "GalleryComposer::composeAssociation() " << typeid(A).name() << " " << typeid(B).name() << std::endl;
  for(auto product: findByType<assn_t>(m_Event->getTTree())) {
    gallery::Handle< assn_t > assnhandle;
    {boost::mutex::scoped_lock b(m_gallery_mutex); boost::mutex::scoped_lock g(global_gallery_mutex);  m_Event->getByLabel(product.second,assnhandle);}
    if(assnhandle->size()>0) {
      // Add a->b and b->a.  Do seperately in order to keep the cached iterators efficient.
      for(const auto& assnpair: *assnhandle) {
        // debugging only
        // const art::BranchDescription* desc1 = m_Event->dataGetterHelper()->branchMapReader().productToBranch( assnpair.first.id());
        // std::string name1 = stripdots(desc1->branchName());
        // const art::BranchDescription* desc2 = m_Event->dataGetterHelper()->branchMapReader().productToBranch( assnpair.second.id());
        // std::string name2 = stripdots(desc2->branchName());
        // printf("%20s %5d  %20s %5d",name1.c_str(),assnpair.first.key(),name2.c_str(),assnpair.second.key());
        m_assn_helper->add( assnpair.first.id(), assnpair.first.key(), assnpair.second.id(), assnpair.second.key());
      }
      for(const auto& assnpair: *assnhandle)
        m_assn_helper->add( assnpair.second.id(), assnpair.second.key(), assnpair.first.id(), assnpair.first.key());
    }
  }
}




  // Some wonky stuff to help me do template combinatorics. See:https://stackoverflow.com/a/44298335/2596881
template <class T> struct tag { };
template <class... Ts> struct type_list { };

template<typename A, typename B>
void foo(GalleryComposer& c, tag<A>, tag<B> ) {
  c.composeAssociation<A,B>();
}

// This hack keeps me from looking at types association<a,a> which are apparemently
// forbidden by the ART code
template<typename A>
void foo(GalleryComposer& c, tag<A>, tag<A> ) {
  // std::cout << "Avoiding duplicate types" << std::endl;
}


template <class F, class... Ts>
void for_each(GalleryComposer& c,F f, type_list<Ts...>) {
    using swallow = int[];
    (void)swallow{0, (void(f(c,tag<Ts>{})), 0)...};
}

template <class TL, class X>
struct Inner {
    template <class Y>
    void operator()(GalleryComposer& c, tag<Y> ) {
        foo(c,tag<X>{}, tag<Y>{} );
    }
};

template <class TL>
struct Outer {
    template <class X>
    void operator()(GalleryComposer& c, tag<X> ){
        for_each(c,Inner<TL, X>{}, TL{});
    }
};



void GalleryComposer::composeAssociations()
{
  TimeReporter timer("Associations");
    
  m_assn_helper.reset(new GalleryAssociationHelper());
  json assns;


  // Variadic template magic!
  // The helper code above sorts the lines below into doing all combination
  // of data products in this list, looking for Assns<A,B> and Assns<B,A> for each pair.

  if( std::string::npos != m_options.find("_ALLASSNS_")) {
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

    using association_types4 = type_list<
        recob::Track,
        recob::Hit
      >;
    for_each(*this,Outer<association_types4>{}, association_types4{});

  }

  // Read out the association objects.
  {
    TimeReporter timer("Associations-output");    
    m_assn_helper->output(*m_Event,assns);
  }

  
  // cout << "Association total size: " << assns.str().length() << std::endl;
  {
    boost::mutex::scoped_lock lck(m_output_mutex);
    m_result["associations"] = assns;
    m_stats["Associations"]=timer.t.Count();
    
  }
}

template<typename T>  void     
GalleryComposer::composeSkeleton(nlohmann::json& out) {
  std::cout << "composeSkeleton " << boost::core::demangle( typeid(T).name() ) << std::endl;
  auto products = findByType< std::vector<T> >(m_Event->getTTree());
  for(auto product: products) {
    // out[stripdots(product.first)] = true;
    
    // std::cout << "Found " << boost::core::demangle( typeid(T).name() )  <<" object " << product.first << std::endl;
    gallery::Handle<std::vector<T>> handle;            
    { // Create a scope
      boost::mutex::scoped_lock b(m_gallery_mutex); // Mutex thread lock exists within brace scope
      boost::mutex::scoped_lock g(global_gallery_mutex); 
      m_Event->getByLabel(product.second,handle); // Get data from the file
    }
    
    if(handle.isValid()) {
      out[stripdots(product.first)] = handle->size();
    }
  }
}

void GalleryComposer::composeSkeleton(nlohmann::json& out)
{
  std::cout << "SKELETON" << std::endl;
  composeSkeleton< recob::Hit       >(out["hits"]);
  composeSkeleton< recob::Wire      >(out["cal"]);
  composeSkeleton< raw::RawDigit    >(out["raw"]);
  composeSkeleton< recob::SpacePoint>(out["spacepoints"]);
  composeSkeleton< recob::Cluster   >(out["clusters"]);
  composeSkeleton< recob::Track     >(out["tracks"]);
  composeSkeleton< recob::Shower    >(out["showers"]);
  composeSkeleton< recob::EndPoint2D>(out["endpoint2d" ]);
  composeSkeleton< recob::PFParticle>(out["pfparticles"]);
  composeSkeleton< recob::OpFlash   >(out["opflashes"  ]);
  composeSkeleton< recob::OpHit     >(out["ophits"     ]);
  composeSkeleton< raw::OpDetPulse  >(out["oppulses"]);
  composeSkeleton< simb::GTruth     >(out["gtruth"]);
  composeSkeleton< simb::MCTruth    >(out["mctruth"]);
  composeSkeleton< simb::MCParticle >(out["particles"]);
}



template<typename T> bool GalleryComposer::composePiece(const std::string& name, nlohmann::json& out)
{
  // Constructs part of the output.
  // T is a type. This looks for a vector<T> object in the file with InputTag matching 'name', and creates an
  // array of the T objects translated to json, then puts it into out[name]
  // If name is "*", then it puts every available name in.  Otherwise, just one should go in.
  bool got = false;
  auto products = findByType< std::vector<T> >(m_Event->getTTree());
  for(auto product: products) {
    std::string pname = stripdots(product.first);
    // std::cout << "Looking for match: " << name << " match? " << pname << std::endl;
    if((name=="*") || (name == pname)) { // allow wildcard match, which means "go get 'em all'"
      gallery::Handle< std::vector<T> > handle;            

      { // Create a scope
        boost::mutex::scoped_lock b(m_gallery_mutex); // Mutex thread lock exists within brace scope
        boost::mutex::scoped_lock g(global_gallery_mutex); 
        m_Event->getByLabel(product.second,handle); // Get data from the file
      }
      if(handle.isValid()) {
        composeObject(*handle,out[pname]);
        got=true; // at least one.
      }      
    }
  }
  return got;
}

template<typename Out>
void split(const std::string &s, char delim, Out result) {
    std::stringstream ss(s);
    std::string item;
    while (std::getline(ss, item, delim)) {
        if(item.size()>0) *(result++) = item;
    }
}
std::vector<std::string> split(const std::string &s, char delim) {
    std::vector<std::string> elems;
    split(s, delim, std::back_inserter(elems));
    return elems;
}

Output_t GalleryComposer::satisfy_request(Request_t request)
{
  std::cout << "GALLERY COMPOSER!!!" << std::endl;
  TimeReporter timer("TOTAL");
  m_progress_so_far =0;
  m_progress_target = 10;
  
  m_request = request;
  std::string filename = m_request->value("filename","");
  m_stats = json::object();
  
  if(filename.size()==0) {
    return Error("No file requested");
  }
  
  bool same_file_as_last_request = (   m_Event && m_last_request && ( m_filename == filename) );
  if(!same_file_as_last_request) {
    // This is a new file we haven't looked at before.
    m_filename = filename;
    progress_made("Opening file",0);
    {
      // Global mutex lock!
      boost::mutex::scoped_lock b(global_gallery_mutex);      
      TimeReporter tr("Open file");
      gallery::Event* event = new gallery::Event({filename});
      m_Event.reset(event);
      tr.addto(m_stats);
    }    
    std::cout << "Not changing file." << std::endl;
  }

  // Is the file+event specification the same?
  if(same_file_as_last_request
    && ( (*m_last_request)["selection"] == (*m_request)["selection"] )
    && ( (*m_last_request)["entrystart"] == (*m_request)["entrystart"] )
    && ( (*m_last_request)["entryend"] == (*m_request)["entryend"] ) ) 
  {
    // We do not need to load the event again.
    std::cout << "Not changing event." << std::endl;
    m_result = json::object();
  } else {

    std::string sel   = request->value("selection","1");
    long long     start = request->value("entrystart",(long long)0);
    long long     end   = request->value("entryend",(long long)999999999);
    m_entry = start;  
    
    {
      TimeReporter tr("Find entry");
      progress_made("Finding event");
      std::string error;
      std::cout << "calling find_entry_in_tree: " << m_Event->getTTree() << "\t" << sel << "\t" << start << "\t" << end << std::endl;
      m_entry = Composer::find_entry_in_tree( m_Event->getTTree(), sel, start, end, error);
      if(m_entry<0) {
        return Error("Could not find entry in tree: "+error);
      } 
      tr.addto(m_stats);
    }
    {
      TimeReporter tr("GoTo");
      progress_made("Loading event");
      boost::mutex::scoped_lock b(global_gallery_mutex);      
    
      m_Event->goToEntry(m_entry);
      tr.addto(m_stats);
    }
    // Source object for this event.
    json source;
    source["file"] = m_filename;
    source["entry"] = m_entry;
    source["numEntriesInFile"] = m_Event->getTTree()->GetEntriesFast();
    art::EventAuxiliary const& aux = m_Event->eventAuxiliary();
    source["run"]=aux.id().run();
    source["subrun"]=aux.id().subRun();
    source["event"]=aux.id().event();
    m_result["source"] = source;
  }
  
  m_result["request"] = *request;  
  m_options = request->value("options",std::string(""));
  
  m_current_event_dir_name  = m_CacheStoragePath;
  m_current_event_url       = m_CacheStorageUrl;
  
  //
  // OK, now build the result.
  //
  m_result["composer_id"] = m_id;
  m_result["monitor"] = monitor_data();
  
  // Every time (it's cheap)
  progress_made("Composing header");
  composeHeaderData();
  
  // find if there is 'piece' or 'pieces' in the request
  json pieces = json::array();
  if((*request)["pieces"].is_array()) pieces = (*request)["pieces"];
  if(!(*request)["piece"].is_null()) pieces.push_back((*request)["piece"]);
  
  std::vector<std::string> atest = split("/a/b/c/d//e/f/",'/');
  m_result["testtest"] = json(atest);
  
  if(pieces.size() >0 ) {
    dispatch_piece(json({{"source",m_result["source"]}}));
    dispatch_piece(json({{"header",m_result["header"]}}));
    dispatch_piece(json({{"monitor",m_result["monitor"]}}));
    for( auto& p: pieces ) {
      if(p.is_string()) {
        std::vector<std::string> a = split(p.get<std::string>(),'/');
        if(a.size()>1) {
          std::string type = a[0];
          std::string name = a[1];
          std::cout << "Piece request: composing " << type << " " << name << std::endl;
          progress_made("Piece "+type+" "+name);
          json outPiece;
          if(type=="skeleton"   ) composeSkeleton(outPiece["skeleton"]);
          if(type=="hits"       ) composePiece<recob::Hit       >( name, outPiece[type] );
          if(type=="spacepoints") composePiece<recob::SpacePoint>( name, outPiece[type] );
          if(type=="clusters"   ) composePiece<recob::Cluster   >( name, outPiece[type] );
          if(type=="tracks"     ) composePiece<recob::Track     >( name, outPiece[type] );
          if(type=="showers"    ) composePiece<recob::Shower    >( name, outPiece[type] );
          if(type=="endpoint2d" ) composePiece<recob::EndPoint2D>( name, outPiece[type] );
          if(type=="pfparticles") composePiece<recob::PFParticle>( name, outPiece[type] );
          if(type=="opflashes"  ) composePiece<recob::OpFlash   >( name, outPiece[type] );
          if(type=="ophits"     ) composePiece<recob::OpHit     >( name, outPiece[type] );
          if(type=="oppulses"   ) composePiece<raw::OpDetPulse  >( name, outPiece[type] );
    
          // FIXME: change in MC structure.
          if(type=="gtruth"   ) composePiece<simb::GTruth    >( name, outPiece[type] );
          if(type=="mctruth"  ) composePiece<simb::MCTruth   >( name, outPiece[type] );
          if(type=="particles") composePiece<simb::MCParticle>( name, outPiece[type] );
          if(type=="stats")     outPiece["stats"] = m_result["stats"];
          // dispatch it.
          dispatch_piece(outPiece);
        }
      }        
    }
    m_result["stats"] = m_stats;
    return dump_result();    
  }
  
  // Legacy code: do the entire event.
  
  // parse some options.
  int doCal = 1;
  int doRaw = 1;
  if( std::string::npos != m_options.find("_NOCAL_")) doCal = 0;
  if( std::string::npos != m_options.find("_NORAW_")) doRaw = 0;

  {
      TimeReporter tt("availability");
      if(!doCal) composeCalAvailability(); // just look at branch names.
      if(!doRaw) composeRawAvailability();
      tt.addto(m_stats);
  }
  
  // Wire data.
  // End first so background image conversion tasks can be Ended as we build the rest.
  progress_made("Composing recob::Wire image");  
  if(doCal)   composeWires();
  progress_made("Composing raw::Digit image");  
  if(doRaw)   composeRaw();

  // Need to think about concurrency here At the moment it's fine, since there's no threading under the hood.
  composePiece< recob::Hit       > ( "*", m_result["hits"       ] );
  composePiece< recob::SpacePoint> ( "*", m_result["spacepoints"] );
  composePiece< recob::Cluster   > ( "*", m_result["clusters"   ] );
  composePiece< recob::Track     > ( "*", m_result["tracks"     ] );
  composePiece< recob::Shower    > ( "*", m_result["showers"    ] );
  composePiece< recob::EndPoint2D> ( "*", m_result["endpoint2d" ] );
  composePiece< recob::PFParticle> ( "*", m_result["pfparticles"] );
  composePiece< recob::OpFlash   > ( "*", m_result["opflashes"  ] );
  composePiece< recob::OpHit     > ( "*", m_result["ophits"     ] );
  composePiece< raw::OpDetPulse  > ( "*", m_result["oppulses"   ] );

  json mc;
  bool got_mc = false;
  got_mc |= composePiece <simb::GTruth>     ("*", mc["gtruth"   ] );
  got_mc |= composePiece <simb::MCTruth>    ("*", mc["mctruth"  ] );
  got_mc |= composePiece <simb::MCParticle> ("*", mc["particles"] );
  if(got_mc) m_result["mc"] = mc;    
  
  progress_made("Composing associations");  
  composeAssociations();

  // boost::thread_group threads;
  // if(doCal)   threads.create_thread(boost::bind(&GalleryComposer::composeWires,this));
  // if(doRaw)   threads.create_thread(boost::bind(&GalleryComposer::composeRaw,this));

  // threads.create_thread(boost::bind(&GalleryComposer::composeHits,this));
  // threads.create_thread(boost::bind(&GalleryComposer::composeClusters,this));
  // threads.create_thread(boost::bind(&GalleryComposer::composeEndpoint2d,this));
  // threads.create_thread(boost::bind(&GalleryComposer::composeSpacepoints,this));
  // threads.create_thread(boost::bind(&GalleryComposer::composeTracks,this));
  // threads.create_thread(boost::bind(&GalleryComposer::composeShowers,this));
  // threads.create_thread(boost::bind(&GalleryComposer::composePFParticles,this));
  //
  // // Optical
  // threads.create_thread(boost::bind(&GalleryComposer::composeOpPulses,this));
  // threads.create_thread(boost::bind(&GalleryComposer::composeOpFlashes,this));
  // threads.create_thread(boost::bind(&GalleryComposer::composeOpHits,this));
  // threads.create_thread(boost::bind(&GalleryComposer::composeAuxDets,this));
  //
  // threads.create_thread(boost::bind(&GalleryComposer::composeMC,this));
  // threads.create_thread(boost::bind(&GalleryComposer::composeAssociations,this));
  //    
  // threads.join_all();
  // Database lookup.
  // slomon_thread.join();
  // JsonElement hv; hv.setStr(slm.val);
  // m_result["hv"] = hv;  
  timer.addto(m_stats);
  m_result["stats"] = m_stats;
  return dump_result();
}

// Json_t GalleryComposer::get_or_compose(std::string jsonPointer);
    