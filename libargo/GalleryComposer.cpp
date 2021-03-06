#include "GalleryComposer.h"
#include "TimeReporter.h"

#include "gallery/Event.h"

#include <TH1D.h>
#include <TLeaf.h>

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
#include "lardataobj/RawData/raw.h"   // compression fns are here
#include "nusimdata/SimulationBase/GTruth.h"
#include "nusimdata/SimulationBase/MCTruth.h"
#include "nusimdata/SimulationBase/MCFlux.h"

#include "lardataobj/RecoBase/TrackHitMeta.h"
#include "lardataobj/RecoBase/VertexAssnMeta.h"

// Uboone specific:
#include "ubobj/Trigger/ubdaqSoftwareTriggerData.h"

#include "json_tools.h"
#include "MakePng.h"
#include "EncodedTileMaker.h"
#include "RootToJson.h"
#include "GetSloMonDB.h"
#include "wireOfChannel.h"
#include "waveform_tools.h"
#include "DeadChannelMap.h"
#include "CoherentNoiseFilter.h"
#include "ReadLarsoftConfig.h"
#include "Plexus.h"

#include "boost/thread/thread.hpp"
#include "boost/thread/mutex.hpp"
#include "boost/thread/shared_mutex.hpp"
#include "boost/core/demangle.hpp"

#include <signal.h>
#include <iostream>
// Utility functions:

using ntagg::json;
using std::vector;
using std::string;
using std::endl;
using std::cout;

using boost::mutex;
boost::mutex global_gallery_mutex;


std::string stripdots(const std::string& s)
{
  std::string out = s;
  size_t pos;
  while((pos = out.find('.')) != std::string::npos)  out.erase(pos, 1);
  return out;
}

bool match_piece_request(std::string& pname, const std::string& request_name, size_t i)
{
  if(pname == request_name) return true; // As requested.
  if(request_name == "*") return true; // User requested everything.
  if(request_name == "?" && i==0) return true; // User requested first object.
  return false;
}

GalleryComposer::GalleryComposer() 
  : m_stats(ntagg::json::object())
  , m_Event(nullptr)
{
    std::cout << "GalleryComposer ctor" << std::endl; 

}

GalleryComposer::~GalleryComposer() 
  // : m_Event(nullptr)
  // , m_stats(ntagg::json::object())
{
    std::cout << "GalleryComposer dtor" << std::endl; 
    // std::cout << "m_Event:" << ((m_Event)?"set":"unset") << std::endl; 
}

void GalleryComposer::configure(Config_t config)
{
  m_config = config; 
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


// Legacy code when we wanted to do everything. composePiece now does this job with more flexibility
// template<typename V>
// bool GalleryComposer::composeObjectsVector(const std::string& output_name, json& output)
// {
//   json reco_list;  // Place to store all objects of type (e.g. all spacepoint lists.)
//   TimeReporter cov_timer(output_name);
//
//   progress_made("Composing "+output_name);
//
//   int found = 0;
//   auto products = findByType<V>(m_Event->getTTree());  // Get a list of all products matching template
//   for(auto product: products) {
//     // std::cout << "Looking at " << boost::core::demangle( typeid(V).name() ) <<" object " << product.first << std::endl;
//
//     TimeReporter timer(product.first);    // This object creates statistics on how long this reco took.
//     gallery::Handle<V> handle;
//
//     { // Create a scope
//       mutex::scoped_lock b(m_gallery_mutex); // Mutex thread lock exists within brace scope
//       mutex::scoped_lock g(global_gallery_mutex);
//       m_Event->getByLabel(product.second,handle); // Get data from the file
//     }
//     if(!handle.isValid()) {
//       std::cerr << "No data!" << std::endl;
//       continue;
//     }
//     found++;
//
//     json jlist = json::array();    // List of objects (e.g. Kalman Spacepoints)
//     for(const auto& item: *handle) {
//       // item is a specific object (e.g. SpacePoint), jitem is the objected moved to JSON (one spacepoint)
//       json jitem;
//       composeObject(item,jitem);
//       jlist.push_back(jitem); // Add to list
//     }
//     reco_list[stripdots(product.first)] = jlist; // Add this list of spacepoints to the list of reco objects
//     //timer.addto(m_stats);    // Naw, don't need that level of ganularity. Needs mutex.
//   }
//   {
//     mutex::scoped_lock lck(m_output_mutex);  // Scope a lock around the global output object
//     output[output_name] = reco_list;                // Add the output.
//     cov_timer.addto(m_stats);
//   }
//   return(found>0);
// }
  
template<typename T>
void GalleryComposer::composeObject(const T&, json& out, const std::string& type)
{
  out[type] = "Unimplimented";
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
        mutex::scoped_lock b(m_gallery_mutex); 
        mutex::scoped_lock g(global_gallery_mutex);      
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
  {
    std::cout << "SWTRIGGER...." << std::endl;
    auto products = findByType< vector<raw::ubdaqSoftwareTriggerData> >(m_Event->getTTree());
    for(auto product: products) {

      std::cout << "Looking at SW Trigger object " << product.first << std::endl;
      gallery::Handle< vector<raw::ubdaqSoftwareTriggerData> > handle;
      {mutex::scoped_lock b(m_gallery_mutex); mutex::scoped_lock g(global_gallery_mutex); m_Event->getByLabel(product.second,handle);}
      if(!handle.isValid()) { continue;  }
      json sw_triggers;
      cout << "trigs: " << handle->size() << std::endl;
      for(const raw::ubdaqSoftwareTriggerData& swtrig: *handle) {
        for(int i = 0; i< swtrig.getNumberOfAlgorithms(); i++) {
          if(swtrig.getPass(i)) sw_triggers.push_back(swtrig.getTriggerAlgorithm(i));
        }
      }
      trigger["sw_triggers"] = sw_triggers;
    }
  }
  header["trigger"] = trigger;

  {
    mutex::scoped_lock lck(m_output_mutex);
    m_result["header"] = header;
  }
  ttt.addto(m_stats);
}

void GalleryComposer::composeHints()
{
  // Ok, try a hack.
  m_result["hints"] = json();
  size_t num_channels = 0;
  auto products = findByType< vector<raw::RawDigit> >(m_Event->getTTree());
  for(auto product: products) {
      std::string leafname = product.first + "obj_";
      TLeaf* f = m_Event->getTTree()->GetLeaf(leafname.c_str());
      if(!f) continue;
      num_channels = f->GetNdata();
      break;
  }
  if(num_channels>0) {
    m_result["hints"]["channel_count"] = num_channels;
    return;
  }

  products = findByType< vector<recob::Wire> >(m_Event->getTTree());
  for(auto product: products) {
      std::string leafname = product.first + "obj_";
      TLeaf* f = m_Event->getTTree()->GetLeaf(leafname.c_str());
      if(!f) continue;
      num_channels = f->GetNdata();
      break;
  }    
  if(num_channels>0) {
    m_result["hints"]["goodwire_count"] = num_channels;
    return;
  }


  // Takes 30 SECONDS on dune files. Unacceptable.
  // TimeReporter ttt("hints");

  // // lock everything.
  // mutex::scoped_lock b(m_gallery_mutex); 
  // mutex::scoped_lock g(global_gallery_mutex);
  // // Try to get config options.
  // json request = 
  //    " { \"shift_hit_ticks\": {\"conditions\": [{ \"key\": \"module_type\", \"value\": \"RawDigitFilterUBooNE\"}], \"parameter\": \"NumTicksToDropFront\" } "
  //    " , \"gdml\":            {\"conditions\": [{ \"key\": \"service_type\", \"value\": \"Geometry\"}], \"parameter\": \"GDML\" } "
  //    " } "_json;

  // ReadLarsoftConfig(m_Event->getTFile(),request);
  // {
  //   mutex::scoped_lock lck(m_output_mutex);
  //   m_result["hints"] = request;
  // }
  // ttt.addto(m_stats);

}


// default template for vectors:
template<typename TT> 
void GalleryComposer::composeObject(const std::vector<TT>&v, ntagg::json& out, const std::string& type)
{
  out = json::array();
  for(auto item: v) {
    json j;
    composeObject(item,j,type);
    out.push_back(j);
  }
} 

template<>
void GalleryComposer::composeObject(const recob::Hit& hit, ntagg::json& h, const std::string&)
{
  const auto& wid = hit.WireID();
  
  h["Ch"] =     hit.Channel();
  if(wid.Cryostat>0) h["cry"] =    wid.Cryostat;
  if(wid.TPC>0)      h["tpc"] =    wid.TPC;
  h["wire"] =   wid.Wire;
  h["plane"] =  wid.Plane;
  // if(hit.WireID().) 
  h["q"] =      jsontool::fixed(hit.Integral(),0)     ;
  h["t"] =      jsontool::fixed(hit.PeakTime(),1)     ;
  h["t1"] =     jsontool::fixed(hit.StartTick(),1)    ;
  h["t2"] =     jsontool::fixed(hit.EndTick(),1)    ;
} 


template<>
void GalleryComposer::composeObject(const recob::SpacePoint& sp, json& jsp, const std::string& )
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
void GalleryComposer::composeObject(const recob::Track& track, json& jtrk, const std::string& )
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
void GalleryComposer::composeObject(const recob::Shower& shower, json& jshw, const std::string&)
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
  jshw["OpenAngle"] = shower.OpenAngle();

  jshw["totalEnergy"] = json(shower.Energy()); // Implicit Conversion from vector<double> to json
  jshw["dEdx"] = json(shower.dEdx()); // ditto
  jshw["totMIPEnergy"] = json(shower.MIPEnergy()); // ditto
}


template<>
void GalleryComposer::composeObject(const recob::PFParticle& p, json& jpf, const std::string& )
{
  jpf["self"    ] = p.Self()    ;
  jpf["pdg"     ] = p.PdgCode() ;
  jpf["parent"  ] = p.Parent()  ; 
  jpf["daughters"] =  json(p.Daughters()); // Implicit conversion vector<size_t> to json
}

template<>
void GalleryComposer::composeObject(const recob::OpFlash& flash, json& jflash, const std::string&)
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
void GalleryComposer::composeObject(const raw::OpDetPulse& pulse, json& jobj, const std::string&)
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
void GalleryComposer::composeObject(const recob::OpHit& hit, json& jobj, const std::string&)
{
  jobj["opDetChan"     ] = hit.OpChannel();
  jobj["peakTime"      ] = 1e3*hit.PeakTime();
  jobj["width"         ] = hit.Width();
  jobj["area"          ] = hit.Area();
  jobj["amp"           ] = hit.Amplitude();
  jobj["pe"            ] = hit.PE();
  jobj["fastToTotal"   ] = hit.FastToTotal();
}

template<>
void GalleryComposer::composeObject(const recob::EndPoint2D& endpoint, json& jobj, const std::string&)
{
  
  jobj["q"        ] = endpoint.Charge();
  jobj["view"     ] = endpoint.View();
  jobj["plane"    ] = endpoint.WireID().Plane;
  jobj["tpc"      ] = endpoint.WireID().TPC;
  jobj["wire"     ] = endpoint.WireID().Wire;
  jobj["t"        ] = endpoint.DriftTime();
  jobj["strength" ] = endpoint.Strength();

}

/////
//// Images
////



template<typename T> bool GalleryComposer::composePieceImage( const std::string& type, const std::string& name, ntagg::json& out)
{
  bool got = false;
  auto products = findByType< std::vector<T> >(m_Event->getTTree());
  size_t nproducts = products.size();
  for(size_t i=0;i<nproducts;i++) {
    auto& product = products[i];
    std::string pname = stripdots(product.first);
    if(match_piece_request(pname,name,i)) {
      gallery::Handle< std::vector<T> > handle;            
      { // Create a scope
        mutex::scoped_lock b(m_gallery_mutex); // Mutex thread lock exists within brace scope
        mutex::scoped_lock g(global_gallery_mutex); 
        m_Event->getByLabel(product.second,handle); // Get data from the file
      }
      if(handle.isValid()) {
        composeObjectImage(*handle,type,product.second,out[pname]);
        got=true; // at least one.
      }            
    }
  }
  return got;
    
}

template <>
void GalleryComposer::composeObjectImage(const std::vector<recob::Wire>&v, const std::string& type, art::InputTag tag, ntagg::json& out)
{
  bool is_supernova = (tag.label() == "sndaq");
  
  size_t nchannels = v.size();
  if(nchannels<1) {
    // std::cout << "No entries in object;" << std::endl;
    out["error"] = "No entries";
    return;
  }

  bool is_uboone = (nchannels>8000 && nchannels<8456);

  if(is_uboone) {
    if(!gDeadChannelMap->ok()) gDeadChannelMap->RebuildFromTimestamp(m_event_time/1000.);
    if(!gDeadChannelMap->ok()) gDeadChannelMap->Rebuild(m_config->value("DeadChannelDB" ,"db/dead_channels.txt"));
    if(!gDeadChannelMap->ok()) out["warning"].push_back("Could not initialize dead channel map");
  }

  std::shared_ptr<wiremap_t> wireMap(new wiremap_t(nchannels));
  std::shared_ptr<wiremap_t> noiseMap(new wiremap_t(nchannels));
  size_t ntdc = v[0].NSignal();

  if(ntdc<=0) return;
  for(const recob::Wire& wire : v) {
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
    }
    waveform_ptr->_ped = 0;

    // Waveform storage.
    if(wireMap->size() <= channel) wireMap->resize(channel+1);
    if(noiseMap->size() <= channel) noiseMap->resize(channel+1);
    (*wireMap)[channel] = waveform_ptr;
    (*noiseMap)[channel] = noiseform_ptr;
    if(is_uboone) waveform_ptr->_status = gDeadChannelMap->status(channel);
  }

  // Now we should have a semi-complete map.
  int nwire = wireMap->size();
  int tilesize = m_request->value("tilesize",2400);
  if(type.find("-lowres")!=std::string::npos) {
    // Do the low-res version.
    TimeReporter lowres_stats("time_to_make_lowres");
    MakeLowres(    out,
                  wireMap,
                  noiseMap,
                  nwire,
                  ntdc, m_CacheStoragePath, m_CacheStorageUrl, tilesize, false );
  } else {
    // High-res.
    int tilesize = m_request->value("tilesize",2400);
    MakeEncodedTileset(     out,
                            wireMap,
                            noiseMap,
                            nwire,
                            ntdc,
                            m_CacheStoragePath,
                            m_CacheStorageUrl,
                            tilesize,
                            false );
  }
  
}

// Specific overrides for image data
//
// Raw wires
template <>
void GalleryComposer::composeObjectImage(const std::vector<raw::RawDigit>&v, const std::string& type, art::InputTag /*tag*/, ntagg::json& out)
{
  TimeReporter tr("Raw digits");
  size_t nchannels = v.size();
  if(nchannels<1) {
    // std::cout << "No entries in object;" << std::endl;
    out["error"] = "No entries";
    return;
  }
  bool is_uboone = (nchannels>8000 && nchannels<8456);

  gov::fnal::uboone::online::Plexus plex;
  if(is_uboone) {
    if(!gDeadChannelMap->ok()) gDeadChannelMap->RebuildFromTimestamp(m_event_time/1000.);
    if(!gDeadChannelMap->ok()) gDeadChannelMap->Rebuild(m_config->value("DeadChannelDB" ,"db/dead_channels.txt"));
    if(!gDeadChannelMap->ok()) out["warning"].push_back("Could not initialize dead channel map");
    json plexus_config = m_config->value("plexus",json::object());
    plex.assignSources(
      plexus_config.value("tpc_source","sqlite db/current-plexus.db"),
      plexus_config.value("pmt_source","sqlite db/current-plexus.db"),
      plexus_config.value("tpc_source_fallback",""),
      plexus_config.value("pmt_source_fallback","")
    );  
    if(m_event_time>0) plex.rebuild(m_event_time/1000.);    
  }


  std::shared_ptr<wiremap_t> wireMap(new wiremap_t(v.size()));

  size_t ntdc = 0;
  for(const raw::RawDigit& rawdigit: v) {
    short pedestal = rawdigit.GetPedestal();
    int wire = rawdigit.Channel();
    if(pedestal<0) pedestal = 0; // Didn't read correctly.

    
    waveform_ptr_t waveform_ptr;
    if(rawdigit.Compression()== raw::kNone) {
      waveform_ptr = waveform_ptr_t(new waveform_t( rawdigit.ADCs() )); // make a copy
    } else {
      waveform_ptr = waveform_ptr_t(new waveform_t( rawdigit.Samples() ));
      raw::Uncompress(rawdigit.ADCs(),*waveform_ptr,rawdigit.GetPedestal(), rawdigit.Compression());
    }
    waveform_t& waveform = *waveform_ptr;
    if(is_uboone) waveform._servicecard = plex.get_wirenum(wire).servicecard_id();
    size_t nsamp = waveform.size();

    // Find the pedestal manually.
    waveform_tools::pedestal_computer pedcomp;
    for(int i=0;i<nsamp;i++) pedcomp.fill(waveform[i]);
    pedcomp.finish(20);
    int ped = pedcomp.ped();
    // std::cout << "wire" << wire << " " << ped <<" " << pedcomp.pedsig() << std::endl;
    // double rms = pedcomp.pedsig(); // auto-adjusted rms.

    for(size_t i =0; i< nsamp; i++) {
      waveform[i] -= ped;
    }
    waveform._ped = ped;
    if(is_uboone) waveform._status = gDeadChannelMap->status(wire);

    if(wireMap->size() <= wire) wireMap->resize(wire+1);
    (*wireMap)[wire] = waveform_ptr;
    ntdc = std::max(ntdc,waveform_ptr->size());
  }
  
  size_t nwire = wireMap->size();
  std::shared_ptr<wiremap_t> noiseMap(new wiremap_t(nwire));

  if(is_uboone) CoherentNoiseFilter(wireMap,noiseMap,nwire,ntdc);

  std::cout << "RAWDIGIT time to assemble data for image-building:";
  tr.report();
  int tilesize = m_request->value("tilesize",2400);

  if(type.find("-lowres")!=std::string::npos) {
    // Do the low-res version.
    TimeReporter lowres_stats("time_to_make_lowres");
    MakeLowres(    out,
                   wireMap,
                   noiseMap,
                   nwire,
                   ntdc, m_CacheStoragePath, m_CacheStorageUrl, tilesize, false );
  } else {
    // High-res.
    MakeEncodedTileset(     out,
                            wireMap,
                            noiseMap,
                            nwire,
                            ntdc,
                            m_CacheStoragePath,
                            m_CacheStorageUrl,
                            tilesize,
                            false );
  }
  std::cout << "RAWDIGIT total time:";
  
};


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
void GalleryComposer::composeObject(const simb::MCParticle& particle, json& jobj, const std::string&)
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
void GalleryComposer::composeObject(const simb::MCNeutrino& neutrino, json& jnu, const std::string&)
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
void GalleryComposer::composeObject(const simb::GTruth& truth, json& jobj, const std::string&)
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
void GalleryComposer::composeObject(const simb::MCTruth& truth, json& jobj, const std::string&)
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
        json j2 = json::array();
        
        art::BranchDescription const& desc2 = event.getProductDescription(itr2.first);
        std::string name2 = stripdots(desc2.branchName());

        // std::cout << "\t" << name2 << std::endl;
        
        
        for(auto& itr3: itr2.second) {
          j2[itr3.first] = itr3.second;
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
    {mutex::scoped_lock b(m_gallery_mutex); mutex::scoped_lock g(global_gallery_mutex);  m_Event->getByLabel(product.second,assnhandle);}
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
        recob::Hit,
        recob::Shower
      >;
    for_each(*this,Outer<association_types3>{}, association_types3{});

    using association_types4 = type_list<
        recob::PFParticle,
        recob::Shower,
        recob::Track        
      >;
    for_each(*this,Outer<association_types4>{}, association_types4{});

    using association_types5 = type_list<
        recob::Track,
        recob::Hit
      >;
    for_each(*this,Outer<association_types5>{}, association_types5{});

  }

  // Read out the association objects.
  {
    TimeReporter timer("Associations-output");    
    m_assn_helper->output(*m_Event,assns);
  }

  
  // cout << "Association total size: " << assns.str().length() << std::endl;
  {
    mutex::scoped_lock lck(m_output_mutex);
    m_result["associations"] = assns;
    m_stats["Associations"]=timer.t.Count();
    
  }
}


////////////////////////////////////////////////
// Associations by piece



// https://stackoverflow.com/questions/58523155/is-there-a-way-to-override-a-template-method-matching-only-when-two-template-par
// template <typename A, A> 
// bool GalleryComposer::composeAssociationFromToMatch(const std::string&, const std::string&, Composer::piece_t&, ntagg::json&)
// {
//   return false;
// }

// don't allow specific combinations:
template <> bool GalleryComposer::composeAssociationFromToMatch<recob::Hit, recob::Hit>(const std::string&, const std::string&, Composer::piece_t&, ntagg::json&){return false;}
template <> bool GalleryComposer::composeAssociationFromToMatch<recob::SpacePoint, recob::SpacePoint>(const std::string&, const std::string&, Composer::piece_t&, ntagg::json&){return false;}
template <> bool GalleryComposer::composeAssociationFromToMatch<recob::Cluster, recob::Cluster>(const std::string&, const std::string&, Composer::piece_t&, ntagg::json&){return false;}
template <> bool GalleryComposer::composeAssociationFromToMatch<recob::Shower, recob::Shower>(const std::string&, const std::string&, Composer::piece_t&, ntagg::json&){return false;}
template <> bool GalleryComposer::composeAssociationFromToMatch<recob::EndPoint2D, recob::EndPoint2D>(const std::string&, const std::string&, Composer::piece_t&, ntagg::json&){return false;}
template <> bool GalleryComposer::composeAssociationFromToMatch<recob::Track, recob::Track>(const std::string&, const std::string&, Composer::piece_t&, ntagg::json&){return false;}
template <> bool GalleryComposer::composeAssociationFromToMatch<recob::PFParticle, recob::PFParticle>(const std::string&, const std::string&, Composer::piece_t&, ntagg::json&){return false;}
template <> bool GalleryComposer::composeAssociationFromToMatch<recob::OpFlash, recob::OpFlash>(const std::string&, const std::string&, Composer::piece_t&, ntagg::json&){return false;}
template <> bool GalleryComposer::composeAssociationFromToMatch<recob::OpHit, recob::OpHit>(const std::string&, const std::string&, Composer::piece_t&, ntagg::json&){return false;}
template <> bool GalleryComposer::composeAssociationFromToMatch<raw::OpDetPulse, raw::OpDetPulse>(const std::string&, const std::string&, Composer::piece_t&, ntagg::json&){return false;}
template <> bool GalleryComposer::composeAssociationFromToMatch<simb::GTruth, simb::GTruth>(const std::string&, const std::string&, Composer::piece_t&, ntagg::json&){return false;}
template <> bool GalleryComposer::composeAssociationFromToMatch<simb::MCTruth, simb::MCTruth>(const std::string&, const std::string&, Composer::piece_t&, ntagg::json&){return false;}
template <> bool GalleryComposer::composeAssociationFromToMatch<simb::MCParticle, simb::MCParticle>(const std::string&, const std::string&, Composer::piece_t&, ntagg::json&){return false;}

template<typename A, typename B, typename C>
bool GalleryComposer::composeAssociationFromToMatch(const std::string& aname, const std::string& bname, Composer::piece_t& req, ntagg::json& out)
{
  // Get a specific association given product names.
  // Assumption: the first item in each association represents them all
  typedef art::Assns<A,B,C> assn_t;

  bool retval = false;
  std::cout << "GalleryComposer::composeAssociationFromToMatch() " <<  art::TypeID(typeid(A)).friendlyClassName()  << " " << aname << " to " 
                                                                   <<  art::TypeID(typeid(B)).friendlyClassName()  << " " << bname << " with meta "
                                                                   <<  art::TypeID(typeid(C)).friendlyClassName()  << std::endl;
  for(auto product: findByType<assn_t>(m_Event->getTTree())) {
    std::cout << " .. found " << product.second << std::endl;
    gallery::Handle< assn_t > assnhandle;
    {mutex::scoped_lock b(m_gallery_mutex); mutex::scoped_lock g(global_gallery_mutex);  m_Event->getByLabel(product.second,assnhandle);}
    
    // Make a one-shot helper.
    GalleryAssociationHelper assnhelper;

    if(assnhandle->size()>0) {
      // Get the first association and see if it correctly matches the things we're looking for:
      const auto& firstpair = assnhandle->at(0);

      art::BranchDescription const& desc1 = m_Event->getProductDescription(firstpair.first.id());
      std::string name1 = stripdots(desc1.branchName());
      
      if((aname == name1) || (aname == "*") ) {
        art::BranchDescription const& desc2 = m_Event->getProductDescription(firstpair.second.id());
        std::string name2 = stripdots(desc2.branchName());

        if((bname == name2) || (bname == "*")) {

          // Match!
          // Add a->b and b->a.  Do seperately in order to keep the cached iterators efficient.
          for(const auto& assnpair: *assnhandle) {
            assnhelper.add( assnpair.first.id(), assnpair.first.key(), assnpair.second.id(), assnpair.second.key());
          }
          // do in javascript, see ArgoData.js
          // for(const auto& assnpair: *assnhandle) {
          //   assnhelper.add( assnpair.second.id(), assnpair.second.key(), assnpair.first.id(), assnpair.first.key());
          // }
          assnhelper.output(*m_Event,out);
          // assnhelper->output(m_Event,m_result["associations"]); // Needed?
          retval = true;
        }
      }

    }

  }
  return retval;
}

// This is a simple passthrough function for most cases; no metadata in the associations are expected.
template<typename A, typename B>
bool GalleryComposer::composeAssociationFromToMeta(const std::string& aname, const std::string& bname, Composer::piece_t& req, ntagg::json& out)
{
  return false;
}

// But in special cases, we can add a metadata type to search for.
template<> bool GalleryComposer::composeAssociationFromToMeta<recob::Hit,recob::Track>(const std::string& aname, const std::string& bname, Composer::piece_t& req, ntagg::json& out)
{
  return composeAssociationFromToMatch<recob::Hit,recob::Track,recob::TrackHitMeta>(aname, bname, req, out);
}


template<> bool GalleryComposer::composeAssociationFromToMeta<recob::Track,recob::Vertex>(const std::string& aname, const std::string& bname, Composer::piece_t& req, ntagg::json& out)
{
  return composeAssociationFromToMatch<recob::Track,recob::Vertex,recob::VertexAssnMeta>(aname, bname, req, out);
}

template<> bool GalleryComposer::composeAssociationFromToMeta<recob::Cluster,recob::EndPoint2D>(const std::string& aname, const std::string& bname, Composer::piece_t& req, ntagg::json& out)
{
  return composeAssociationFromToMatch<recob::Cluster,recob::EndPoint2D,ushort>(aname, bname, req, out);
}

template<> bool GalleryComposer::composeAssociationFromToMeta<recob::Cluster,recob::Vertex>(const std::string& aname, const std::string& bname, Composer::piece_t& req, ntagg::json& out)
{
  return composeAssociationFromToMatch<recob::Cluster,recob::Vertex,ushort>(aname, bname, req, out);
}


// Try a->b, then b->a
template<typename A, typename B>
bool GalleryComposer::composeAssociationFromTo(Composer::piece_t& req, ntagg::json& out)
{
  std::string aname = "*";
  if(req.size()>3) aname = req[3];

  std::string bname = "*";
  if(req.size()>4) bname = req[4];

  // Try both ways.
  bool retval = false;
  retval =  retval || composeAssociationFromToMatch<A,B>(aname, bname, req, out);
  retval =  retval || composeAssociationFromToMatch<B,A>(bname, aname, req, out);
  retval =  retval || composeAssociationFromToMeta<A,B>(aname, bname, req, out);
  retval =  retval || composeAssociationFromToMeta<B,A>(bname, aname, req, out);

  return retval;
}



template<typename A>
bool GalleryComposer::composeAssociationFrom(Composer::piece_t& req, ntagg::json& out)
{
  if(req.size()<2 || req[2] == "*") {
    // No second type specified, so send them all.
    bool retval = false;
    retval =  composeAssociationFromTo<A,recob::Hit        >( req, out  ) || retval;
    retval =  composeAssociationFromTo<A,recob::SpacePoint >( req, out  ) || retval;
    retval =  composeAssociationFromTo<A,recob::Cluster    >( req, out  ) || retval;
    retval =  composeAssociationFromTo<A,recob::Track      >( req, out  ) || retval;
    retval =  composeAssociationFromTo<A,recob::Shower     >( req, out  ) || retval;
    retval =  composeAssociationFromTo<A,recob::EndPoint2D >( req, out  ) || retval;
    retval =  composeAssociationFromTo<A,recob::PFParticle >( req, out  ) || retval;
    retval =  composeAssociationFromTo<A,recob::OpFlash    >( req, out  ) || retval;
    retval =  composeAssociationFromTo<A,recob::OpHit      >( req, out  ) || retval;
    retval =  composeAssociationFromTo<A,raw::OpDetPulse   >( req, out  ) || retval;
    retval =  composeAssociationFromTo<A,simb::GTruth      >( req, out  ) || retval;
    retval =  composeAssociationFromTo<A,simb::MCTruth     >( req, out  ) || retval;
    retval =  composeAssociationFromTo<A,simb::MCParticle  >( req, out  ) || retval;
    return retval; 
  }
  std::string btype = req[2];
  if(btype == "hits"       ) return composeAssociationFromTo<A,recob::Hit       >( req, out  );
  if(btype == "spacepoints") return composeAssociationFromTo<A,recob::SpacePoint>( req, out  );
  if(btype == "clusters"   ) return composeAssociationFromTo<A,recob::Cluster   >( req, out  );
  if(btype == "tracks"     ) return composeAssociationFromTo<A,recob::Track     >( req, out  );
  if(btype == "showers"    ) return composeAssociationFromTo<A,recob::Shower    >( req, out  );
  if(btype == "endpoint2d" ) return composeAssociationFromTo<A,recob::EndPoint2D>( req, out  );
  if(btype == "pfparticles") return composeAssociationFromTo<A,recob::PFParticle>( req, out  );
  if(btype == "opflashes"  ) return composeAssociationFromTo<A,recob::OpFlash   >( req, out  );
  if(btype == "ophits"     ) return composeAssociationFromTo<A,recob::OpHit     >( req, out  );
  if(btype == "oppulses"   ) return composeAssociationFromTo<A,raw::OpDetPulse  >( req, out  );
  if(btype == "gtruth"     ) return composeAssociationFromTo<A,simb::GTruth     >( req, out  );
  if(btype == "mctruth"    ) return composeAssociationFromTo<A,simb::MCTruth    >( req, out  );
  if(btype == "mcparticles") return composeAssociationFromTo<A,simb::MCParticle >( req, out  );
  return false;
}

bool GalleryComposer::composeAssociation(Composer::piece_t& req, ntagg::json& out)
{
  // Association pieces are requested slightly differently than others:
  // /associations/hits/tracks/HitName/TrackName
  // returned is:
  // /associations/LongHitName/LongTrackName
  //
  // If one of the request types is missing or *, it's assumed the user wants everything that matches.
  if(req.size()<2 || req[1] == "*") {
      composeAssociations(); 
      out = m_result["associations"]; 
      return true;
  }
  // we have at least a typename
  std::string atype = req[1];
 
  if(atype == "hits"       ) return composeAssociationFrom<recob::Hit       >( req, out  );
  if(atype == "spacepoints") return composeAssociationFrom<recob::SpacePoint>( req, out  );
  if(atype == "clusters"   ) return composeAssociationFrom<recob::Cluster   >( req, out  );
  if(atype == "tracks"     ) return composeAssociationFrom<recob::Track     >( req, out  );
  if(atype == "showers"    ) return composeAssociationFrom<recob::Shower    >( req, out  );
  if(atype == "endpoint2d" ) return composeAssociationFrom<recob::EndPoint2D>( req, out  );
  if(atype == "pfparticles") return composeAssociationFrom<recob::PFParticle>( req, out  );
  if(atype == "opflashes"  ) return composeAssociationFrom<recob::OpFlash   >( req, out  );
  if(atype == "ophits"     ) return composeAssociationFrom<recob::OpHit     >( req, out  );
  if(atype == "oppulses"   ) return composeAssociationFrom<raw::OpDetPulse  >( req, out  );
  if(atype == "gtruth"     ) return composeAssociationFrom<simb::GTruth     >( req, out  );
  if(atype == "mctruth"    ) return composeAssociationFrom<simb::MCTruth    >( req, out  );
  if(atype == "mcparticles") return composeAssociationFrom<simb::MCParticle >( req, out  );
  return false;
  
}




template<typename T>  void     
GalleryComposer::composeManifest(ntagg::json& out) {
  std::cout << "composeManifest " << boost::core::demangle( typeid(T).name() ) << std::endl;
  auto products = findByType< std::vector<T> >(m_Event->getTTree());
  for(auto product: products) {
    // This version simply looks for what might be in the file, based on the names of branches in the tree.
    out[stripdots(product.first)] = true;

    // // This version checks things are valid and gives numbers of objects... but is much slower.
    // gallery::Handle<std::vector<T>> handle;
    // { // Create a scope
    //   mutex::scoped_lock b(m_gallery_mutex); // Mutex thread lock exists within brace scope
    //   mutex::scoped_lock g(global_gallery_mutex);
    //   m_Event->getByLabel(product.second,handle); // Get data from the file
    // }
    //
    // if(handle.isValid()) {
    //   out[stripdots(product.first)] = handle->size();
    // }
  }
}

void GalleryComposer::composeManifest(ntagg::json& out)
{
  std::cout << "SKELETON" << std::endl;
  // wireimg is special:
  composeManifest< recob::Wire      >(out["wireimg"]);
  composeManifest< raw::RawDigit    >(out["wireimg"]);

  composeManifest< recob::Hit       >(out["hits"]);
  composeManifest< recob::SpacePoint>(out["spacepoints"]);
  composeManifest< recob::Cluster   >(out["clusters"]);
  composeManifest< recob::Track     >(out["tracks"]);
  composeManifest< recob::Shower    >(out["showers"]);
  composeManifest< recob::EndPoint2D>(out["endpoint2d" ]);
  composeManifest< recob::PFParticle>(out["pfparticles"]);
  composeManifest< recob::OpFlash   >(out["opflashes"  ]);
  composeManifest< recob::OpHit     >(out["ophits"     ]);
  composeManifest< raw::OpDetPulse  >(out["oppulses"]);
  composeManifest< simb::GTruth     >(out["gtruth"]);
  composeManifest< simb::MCTruth    >(out["mctruth"]);
  composeManifest< simb::MCParticle >(out["mcparticles"]);
}



template<typename T> bool GalleryComposer::composePiece( const std::string& type, const std::string& name, ntagg::json& out)
{
  // Constructs part of the output.
  // T is a type. This looks for a vector<T> object in the file with InputTag matching 'name', and creates an
  // array of the T objects translated to json, then puts it into out[name]
  // If name is "*", then it puts every available name in.  Otherwise, just one should go in.
  bool got = false;
  auto products = findByType< std::vector<T> >(m_Event->getTTree());
  std::string inName = name;
  if(name=="?") {
    // This means find anything of this type.  Just go with the first one in the file.
    if(products.size()>0) inName = stripdots(products[0].first);
  }
  size_t nproducts = products.size();
  for(size_t i=0;i<nproducts;i++) {
    auto& product = products[i];
    std::string pname = stripdots(product.first);
    if(match_piece_request(pname,name,i)) {
      gallery::Handle< std::vector<T> > handle;            
      { // Create a scope
        mutex::scoped_lock b(m_gallery_mutex); // Mutex thread lock exists within brace scope
        mutex::scoped_lock g(global_gallery_mutex); 
        m_Event->getByLabel(product.second,handle); // Get data from the file
      }
      if(handle.isValid()) {
        composeObject(*handle,out[pname],type);
        got=true; // at least one.
      }            
    }
  }
  return got;
}




Output_t GalleryComposer::satisfy_request(Request_t request)
{
  std::cout << "GALLERY COMPOSER!!!" << std::endl;
  TimeReporter timer("TOTAL");
  m_progress_so_far =0;
  m_progress_target = 10;
  
  // Is this request just asking for an update of the event?
  bool same_event_request  = (m_Event) // We have an event
                          && (m_cur_event_descriptor.length()>0) // We have a valid event descriptor/hash/thing
                          && (request->value("event_descriptor","") == m_cur_event_descriptor); // it matches the request.
  
  if(!same_event_request) {
    // This is a new event. Act accordingly.
    m_request = request;      
    m_result = json::object();    
    m_stats = json::object();
  }
  
  m_result["request"] = *request;  
  m_options = request->value("options",m_options); // Client can override existing options.
  
  m_current_event_dir_name  = m_CacheStoragePath;
  m_current_event_url       = m_CacheStorageUrl;
  
  
  if(same_event_request) {
    std::cout << "This is an update request." << std::endl;
  } else {
    // Get new file
    std::string filename = m_request->value("filename","");
    if(filename.size()==0) {
      return Error("No file requested");
    }

    bool same_file_as_last_request = (   m_Event && m_last_request && ( m_filename == filename) );
    if(same_file_as_last_request) {
      std::cout << "Not changing file." << std::endl;
    } else {
      // This is a new file we haven't looked at before.
      m_filename = filename;
      progress_made("Opening file",0);
      {
        // Global mutex lock!
        mutex::scoped_lock b(global_gallery_mutex);      
        TimeReporter tr("Open file");
        gallery::Event* event = new gallery::Event({filename});
        m_Event.reset(event);
        tr.addto(m_stats);
      }
    }    

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
      mutex::scoped_lock b(global_gallery_mutex);      
    
      m_Event->goToEntry(m_entry);
      tr.addto(m_stats);
    }

    // Make an event descriptor so client can ask for updates without redoing all that work.
    m_cur_event_descriptor = form_event_descriptor();
    m_result["event_descriptor"] = m_cur_event_descriptor;    

    composeHints();
    dispatch_piece(json({{"hints",m_result["hints"]}}));

    // NB - dispatch_piece is cheap and meaningless if there is no listener!    
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
    dispatch_piece(json({{"source",m_result["source"]}}));
  
    // if a new event, we need to send header stuff.
    // Every time (it's cheap)
    progress_made("Composing header");
    composeHeaderData();
    dispatch_piece(json({{"header",m_result["header"]}}));

    m_result["monitor"] = monitor_data();
    dispatch_piece(json({{"monitor",m_result["monitor"]}}));
    
    composeManifest(m_result["manifest"]);
    dispatch_piece(json({{"manifest",m_result["manifest"]}}));
  } // End of !same_event_request block.

  
  // test_parameter_set_retreival(m_Event->GetTFile())''

  
  //
  // OK, now build anything left in the result.
  //
  
  // find if there is 'piece' or 'pieces' in the request
  pieces_t pieces;
  bool do_pieces  = parse_pieces(*request,pieces);
      

  if(do_pieces) {
    std::cout << "dispatching requested pieces" << endl;
    bool complete = dispatch_existing_pieces(pieces);
    if(complete) return Done();

    for( auto& p: pieces ) {
      std::cout << "Piece request: composing " << p.type << " " << p.name << std::endl;
      progress_made("Composing "+p.type+" "+p.name);
      json outPiece;
      if(p.type=="manifest"   ) outPiece=json({{"manifest",m_result["manifest"]}});
      if(p.type=="hits"       ) composePiece<recob::Hit       >( p.type, p.name, outPiece[p.type]  );
      if(p.type=="spacepoints") composePiece<recob::SpacePoint>( p.type, p.name, outPiece[p.type]  );
      if(p.type=="clusters"   ) composePiece<recob::Cluster   >( p.type, p.name, outPiece[p.type]  );
      if(p.type=="tracks"     ) composePiece<recob::Track     >( p.type, p.name, outPiece[p.type]  );
      if(p.type=="showers"    ) composePiece<recob::Shower    >( p.type, p.name, outPiece[p.type]  );
      if(p.type=="endpoint2d" ) composePiece<recob::EndPoint2D>( p.type, p.name, outPiece[p.type]  );
      if(p.type=="pfparticles") composePiece<recob::PFParticle>( p.type, p.name, outPiece[p.type]  );
      if(p.type=="opflashes"  ) composePiece<recob::OpFlash   >( p.type, p.name, outPiece[p.type]  );
      if(p.type=="ophits"     ) composePiece<recob::OpHit     >( p.type, p.name, outPiece[p.type]  );
      if(p.type=="oppulses"   ) composePiece<raw::OpDetPulse  >( p.type, p.name, outPiece[p.type]  );

      if(p.type=="gtruth"   )    composePiece<simb::GTruth    >( p.type, p.name, outPiece[p.type] );
      if(p.type=="mctruth"  )    composePiece<simb::MCTruth   >( p.type, p.name, outPiece[p.type] );
      if(p.type=="mcparticles")  composePiece<simb::MCParticle>( p.type, p.name, outPiece[p.type] );

      // Note we try looking for both raw::rawDigit and recob::Wire objects. Only one of them will properly match the p.name and get put in, since the p.name contains the product class.
      if(p.type=="wireimg"       ) composePieceImage<raw::RawDigit     >( p.type, p.name, outPiece[p.type] );
      if(p.type=="wireimg"       ) composePieceImage<recob::Wire       >( p.type, p.name, outPiece[p.type] );
      if(p.type=="wireimg-lowres") composePieceImage<raw::RawDigit     >( p.type, p.name, outPiece[p.type] );
      if(p.type=="wireimg-lowres") composePieceImage<recob::Wire       >( p.type, p.name, outPiece[p.type] );
    
      if(p.type=="associations") composeAssociation(p, outPiece["associations"]);

      // dispatch it.
      if(p.type=="stats") { composeAssociations(); outPiece = json({{"stats",m_stats}}); }
      dispatch_piece(outPiece);
    }
    dispatch_piece(json({{"stats",m_stats}}));
    m_result["stats"] = m_stats;

    return Done();
  }
  
  // 
  // Legacy code: build the entire event and return it.
  //
  // parse some options.
  int doCal = 1;
  int doRaw = 1;
  if( std::string::npos != m_options.find("_NOCAL_")) doCal = 0;
  if( std::string::npos != m_options.find("_NORAW_")) doRaw = 0;
  
  // Wire data.
  // End first so background image conversion tasks can be Ended as we build the rest.
  progress_made("Composing recob::Wire images"); 
  composePieceImage<recob::Wire       >( "wireimg",        "*", m_result["wireimg"] );
  composePieceImage<recob::Wire       >( "wireimg-lowres", "*", m_result["wireimg-lowres"] );
  
  

  progress_made("Composing raw::Digit image");  
  composePieceImage<raw::RawDigit     >( "wireimg", "*",        m_result["wireimg"] );
  composePieceImage<raw::RawDigit     >( "wireimg-lowres", "*", m_result["wireimg-lowres"] );
  
  composePiece< recob::Hit       > ( "hits"       , "*", m_result["hits"       ]  );
  composePiece< recob::SpacePoint> ( "spacepoints", "*", m_result["spacepoints"]  );
  composePiece< recob::Cluster   > ( "clusters"   , "*", m_result["clusters"   ]  );
  composePiece< recob::Track     > ( "tracks"     , "*", m_result["tracks"     ]  );
  composePiece< recob::Shower    > ( "showers"    , "*", m_result["showers"    ]  );
  composePiece< recob::EndPoint2D> ( "endpoint2d" , "*", m_result["endpoint2d" ]  );
  composePiece< recob::PFParticle> ( "pfparticles", "*", m_result["pfparticles"]  );
  composePiece< recob::OpFlash   > ( "opflashes"  , "*", m_result["opflashes"  ]  );
  composePiece< recob::OpHit     > ( "ophits"     , "*", m_result["ophits"     ]  );
  composePiece< raw::OpDetPulse  > ( "oppulses"   , "*", m_result["oppulses"   ]  );

  composePiece <simb::GTruth>     ("gtruth"   ,"*", m_result["gtruth"   ] );
  composePiece <simb::MCTruth>    ("mctruth"  ,"*", m_result["mctruth"  ] );
  composePiece <simb::MCParticle> ("mcparticles","*", m_result["mcparticles"] );
  
  progress_made("Composing associations");  
  composeAssociations();

  
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
    