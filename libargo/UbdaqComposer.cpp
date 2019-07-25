//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

#include "UbdaqComposer.h"
#include "TimeReporter.h"
#include "EncodedTileMaker.h"
#include "RootToJson.h"

#include "datatypes/ub_EventRecord.h"
#include "boost/thread/thread.hpp"

#include "DaqFile.h"
#include "waveform_tools.h"
#include "GetSloMonDB.h"

#include "CoherentNoiseFilter.h"
#include "DeadChannelMap.h"
#include "TTimeStamp.h"
#include "TString.h"

#include "ThreadPool.h"
#include <sys/stat.h>

using namespace std;
using namespace gov::fnal::uboone::datatypes;
using gov::fnal::uboone::online::Plexus;

gov::fnal::uboone::online::Plexus gPlexus;

using ntagg::json;

UbdaqComposer::UbdaqComposer()
  : fmintdc(0)
  , fmaxtdc(0)
{
};

void UbdaqComposer::configure(Config_t config)
{
  m_config = config; 
  // Some important things, with defaults.
  m_CacheStoragePath  = m_config->value("CacheStoragePath", std::string("../datacache"));
  m_CacheStorageUrl   = m_config->value("CacheStorageUrl",  std::string("datacache"));
  m_WorkingSuffix     = m_config->value("WorkingSuffix",    "working");
  m_FinalSuffix       = m_config->value("FinalSuffix",      "event");
  m_CreateSubdirCache = m_config->value("CreateSubdirCache" ,true);
  m_max_threads        = m_config->value("max_threads",   5);
  
  gov::fnal::uboone::datatypes::peek_at_next_event<ub_TPC_CardData_v6>(false);
  gov::fnal::uboone::datatypes::peek_at_next_event<ub_PMT_CardData_v6>(false);
  gov::fnal::uboone::datatypes::handle_missing_words<ub_TPC_CardData_v6>(true);
  gov::fnal::uboone::datatypes::handle_missing_words<ub_PMT_CardData_v6>(true);
  
};

  
UbdaqComposer::~UbdaqComposer()
{
}

Output_t UbdaqComposer::satisfy_request(Request_t request)
{
  TimeReporter timer("TOTAL");
  std::cout << "UBDAQ COMPOSER" << std::endl;
  
  m_request = request;
  m_result["request"] = *request;
  
  if(m_cur_event_descriptor.size()>0 &&  (request->value("event_descriptor","") == m_cur_event_descriptor) && m_record) return satisfy_request(request,m_record,m_result["source"]);


  // See if we can find the record in question.
  if(request->find("filename")==request->end()) {
    return Error("No file requested");
  }
  std::string filename =  (*request)["filename"].get<std::string>();
  long long  start = request->value("entrystart",(long long)0);
  long long  end   = request->value("entryend",(long long)99999999999);
  // FIXME: we could now allow a JSON option to get a specific event number instead of an entry.
  long long entry = start;
  
  
  m_options = request->value("options",std::string(""));
  
  DaqFile daqfile(filename);
  if(! daqfile.Good() ) {
    // Bad file.
    return Error(string("Cannot open file ") + filename + " for reading.");
  }
  // Ensure full dissection is on.
  // Explicitly turn on unpacking.
  pmt_crate_data_t::doDissect(true);
  tpc_crate_data_t::doDissect(true);
  trig_crate_data_t::doDissect(true);
  
  // OK, find the entry in question.
  std::shared_ptr<gov::fnal::uboone::datatypes::ub_EventRecord> record;
  try {
    record = daqfile.GetEvent(entry);
  } catch ( std::exception& e ) {
    std::cout << "Caught exception when unpacking from daqfile " << filename << std::endl;
  }

  if(!record) {
    return Error(string("Cannot read or unpack event ") + std::to_string(entry) + " in file " + filename);
  }
  
  json source;
  source["file"] = filename;
  // source["selection"] = inSelection;
  source["start"] = start;
  source["end"] = end;
  source["entry"] = entry;
  source["options"] = m_options;
  source["numEntriesInFile"] = daqfile.NumEvents();
  source["fileClosedCleanly"] = daqfile.ClosedCleanly();

  return satisfy_request(request,record,source);
}


Output_t UbdaqComposer::satisfy_request(Request_t request, 
     std::shared_ptr<gov::fnal::uboone::datatypes::ub_EventRecord> record,
     ntagg::json& source)
{
  m_options = request->value("options",std::string(""));
  m_request = request;

  m_record = record;
  if(!m_record) {
    return Error("Bad record!");
  } 
 
   m_result["source"] = source;
 
  pieces_t pieces;
  bool do_pieces  = parse_pieces(*request,pieces);
  
  if(m_cur_event_descriptor.size()>0 && (request->value("event_descriptor","") == m_cur_event_descriptor) && m_record) {
    std::cout << "UbdaqComposer just returning existing data for " << m_cur_event_descriptor << std::endl;
    bool complete = dispatch_existing_pieces(pieces);
    if(complete) return Done();
  }
  

  // This is a new event requested.
    
  std::string id = Form("r%08d_s%04d_e%08d"
                            ,m_record->getGlobalHeader().getRunNumber()    
                            ,m_record->getGlobalHeader().getSubrunNumber() 
                            ,m_record->getGlobalHeader().getEventNumber()  
                            );
  
  if(m_CreateSubdirCache) {
    m_current_event_dir_name = Form("%s/%s.%s/" // Will get renamed to .event on closeout.
                              ,m_CacheStoragePath.c_str(), id.c_str(),m_WorkingSuffix.c_str());
    m_current_event_url      = Form("%s/%s.%s/"
                              ,m_CacheStorageUrl.c_str(), id.c_str(),m_FinalSuffix.c_str());
  
    ::umask(0000); // need this first??
    ::mkdir(m_current_event_dir_name.c_str(),0777);
    std::cout << "Writing event to " << m_current_event_dir_name << std::endl;
  } else {
    m_current_event_dir_name = m_CacheStoragePath;
    m_current_event_url      = m_CacheStorageUrl;
  }
  
  
  
  ///
  /// Dispatch requested things.   
  ///
  
  bool sn = ( m_record->getTpcSnSEBMap().size()>0 ) ;
  bool tpc =( m_record->getTPCSEBMap().size()>0 );
  
  // Do fast things fast.
  composeHeader();

  m_cur_event_descriptor = form_event_descriptor();
  m_result["event_descriptor"] = m_cur_event_descriptor;    

  if(do_pieces)  dispatch_piece(json({{"header",m_result["header"]}}));

  try{ composePMTs();   } catch(...) { std::cerr << "Caught exception in composePMTs();" << std::endl; }
  try{ composeLaser();  } catch(...) { std::cerr << "Caught exception in composeLaser();" << std::endl; }
  
  json manifest = json::object();
  manifest["ophits"] = json::object();
  if(m_result["ophits"].is_object()) {
    for (json::iterator it = m_result["ophits"].begin(); it != m_result["ophits"].end(); ++it) {
      manifest["ophits"][it.key()] = true; 
    }      
  }
  if(m_result["laser"].is_object()) {
    for (json::iterator it = m_result["laser"].begin(); it != m_result["laser"].end(); ++it) {
      manifest["laser"][it.key()] = true; 
    }      
      }
  
  if(sn) {
    manifest["hits"] = json::object();
    manifest["hits"]["hits_SNDAQ__libargo"] = true;
    manifest["wireimg"]["wireimg_SNDAQ__libargo"] = true;
  }
  if(tpc) {
    manifest["hits"] = json::object();
    manifest["hits"]["hits_DAQ__libargo"] = true;
    manifest["wireimg"]["wireimg_DAQ__libargo"] = true;
  }

  m_result["hints"] = {{ "shift_hit_ticks", 0 }};

  if(do_pieces)  dispatch_piece(json({{"manifest",manifest}}));
  if(do_pieces)  dispatch_piece(json({{"source",m_result["source"]}}));
  if(do_pieces)  dispatch_piece(json({{"ophits",m_result["ophits"]}}));
  if(do_pieces)  dispatch_piece(json({{"laser",m_result["laser"]}}));

  // Start DB lookups.  
  GetSlowMonDB slm(event_time);
  boost::thread slomon_thread(slm);
  // slm();

  if(sn ) try{ composeTPC_SN(); } catch(...) { std::cerr << "Caught exception in composeTPC();" << std::endl; }
  if(tpc) try{ composeTPC();    } catch(...) { std::cerr << "Caught exception in composeTPC();" << std::endl; }

  // Do pedestals.

  if(tpc) composeHits(); // Works after coherenet noise!
  if(do_pieces)  dispatch_piece(json({{"hits",m_result["hits"]}}));


  composeWireImages(tpc,manifest["wireimg"].begin().key());
  if(do_pieces)  dispatch_piece(json({{"wireimg-lowres",m_result["wireimg-lowres"]}}));
  if(do_pieces)  dispatch_piece(json({{"wireimg",m_result["wireimg"]}}));

  // Database lookup.
  slomon_thread.join();
  
  json hv; 
  hv = slm.val;
  m_result["hv"] = json::object();
  m_result["hv"]["slomon"] = hv;
  if(do_pieces)  dispatch_piece(json({{"hv",m_result["hv"]}}));

    
  m_result["stats"] = m_stats;
  if(do_pieces)   dispatch_piece(json({{"stats",m_result["stats"]}}));
  m_result["monitor"] = monitor_data();
  m_result["manifest"] = manifest;

  if(do_pieces){
    json jdone;
    jdone["progress"] = 1;
    jdone["state"] = "Done";
    return Output_t(new std::string(jdone.dump()));  
  }
  return dump_result();
  
}


 
  
double getTime(std::shared_ptr<gov::fnal::uboone::datatypes::ub_EventRecord> record, json& header)
{
  // check the event header.
  const TTimeStamp kValidTime(2014,1,1,0,0,0,true); 

  uint32_t sec = record->LocalHostTime().seb_time_sec;
  uint32_t usec= record->LocalHostTime().seb_time_usec;
  uint32_t nsec= 0;

  ub_GPS_Time const& gps = record->GPSEVTTime();
  if(gps.second  > (double)kValidTime) {
     sec = gps.second ;
     usec= gps.micro;
     nsec= gps.nano;   
  }

  header["seconds"] = sec;
  header["microSeconds"] = usec;
  header["nanoSeconds"] = nsec;
  double daqtime = (sec + usec*1e-6 + nsec*1e-9) * 1000; // in ms
  header["eventTime"] = daqtime; // in ms.

  return daqtime;
}

  
bool UbdaqComposer::composeHeaderTrigger(json& trig)
{
  
   // get trigger card data.
  const ub_EventRecord::trig_map_t trigmap = m_record->getTRIGSEBMap();
  m_trig_frame=0;
  m_trig_time_64MHz=0;
  if(trigmap.size()==0) {
    return false;
  }
  auto const& trigger = m_record->getTRIGSEBMap().begin()->second;
  // auto const& ch = trigger.crateHeader();
  auto const& trigger_cards = trigger.getCards();
  trig["trigger_cards"] = trigger_cards.size();
  // Fixme: look at GPS 
  if(trigger_cards.size()<1) return true;;
  auto const& trigger_header = trigger_cards.begin()->header();
  auto const& trigger_channels = trigger_cards.begin()->getChannels();
  if(trigger_channels.size()<1) return true;;
  auto const& trigger_data = trigger_channels.begin()->header();
  
  trig["triggerword"] = ( (trigger_data.trig_data_1) + ((uint32_t)(trigger_data.trig_data_2) << 16) ) ;

  m_trig_frame      = trigger_header.getFrame();
  m_trig_time_2MHz  = trigger_header.get2MHzSampleNumber();
  m_trig_time_16MHz = (m_trig_time_2MHz<<3) + trigger_header.get16MHzRemainderNumber();
  m_trig_time_64MHz = (m_trig_time_16MHz<<2) + trigger_data.getPhase();

  trig["frame"] = m_trig_frame;
  trig["sample_2MHz"] = m_trig_time_2MHz;
  trig["sample_16MHz"] = m_trig_time_16MHz;
  trig["sample_64MHz"] = m_trig_time_64MHz;
  json sw_triggers;


  std::vector<ub_FEMBeamTriggerOutput> const& sw_trigger_list = m_record->getSWTriggerOutputVector();
  for(auto const& swtrig: sw_trigger_list) {
    if(swtrig.pass) sw_triggers.push_back(swtrig.algo_instance_name);
  }
  trig["sw_triggers"] = sw_triggers;
  return true;
}



void UbdaqComposer::composeHeader()
{
  json header;

  // GET THE TIME
  // Plexus.

  json plexus_config = m_config->value("plexus",json::object());
  gPlexus.assignSources(
    plexus_config.value("tpc_source","sqlite ../db/current-plexus.db"),
    plexus_config.value("pmt_source","sqlite ../db/current-plexus.db"),
    plexus_config.value("tpc_source_fallback",""),
    plexus_config.value("pmt_source_fallback","")
  );  
  
  event_time = getTime(m_record,header)/1000.;
  if(event_time>0) gPlexus.rebuild(event_time);
  if(!gDeadChannelMap->ok()) gDeadChannelMap->RebuildFromTimestamp(event_time);
  if(!gDeadChannelMap->ok()) gDeadChannelMap->Rebuild(m_config->value("DeadChannelDB" ,"db/dead_channels.txt"));
  if(!gDeadChannelMap->ok()) m_result["warning"].push_back("Could not initialize dead channel map");

  header["run"           ] = m_record->getGlobalHeader().getRunNumber()    ;
  header["subrun"        ] = m_record->getGlobalHeader().getSubrunNumber() ;
  header["event"         ] = m_record->getGlobalHeader().getEventNumber()  ;
  
  
  // Get trigger info.
  
  // header["seconds"] = m_record->getGlobalHeader().getSeconds();
  // header["microSeconds"] = m_record->getGlobalHeader().getMicroSeconds();
  // header["nanoSeconds"] = m_record->getGlobalHeader().getNanoSeconds();
  header["recordOrigin"] =  m_record->getGlobalHeader().getRecordOrigin();
  
  header["isRealData"] = 1;
  header["DAQVersionLabel"] = m_record->getGlobalHeader().getDAQVersionLabel();
  header["DAQVersionQualifiers"] = m_record->getGlobalHeader().getDAQVersionQualifiers();
  
  // trigger data.
  json trig;
  composeHeaderTrigger(trig);
  header["trigger"] = trig;
  
  
  m_result["header"] = header;  
}


boost::mutex sChanMutex;
  

void unpack_channel(waveform_ptr_t waveform_ptr, const tpc_crate_data_t::card_t::card_channel_type& channel_data, 
                    const Plexus::Plek& plek,
                    json& outhits) 
{
  // Copy the channel data to my own signed vector array
  waveform_t& waveform = *waveform_ptr;
  waveform.reserve(9600);
  channel_data.decompress(waveform);
  
  int wirenum = plek.wirenum();
  waveform._Ch = wirenum;
  waveform._servicecard = plek._servicecard_id;
  waveform._status = gDeadChannelMap->status(wirenum);
  waveform._plane = plek.plane();
  waveform._planewire = plek.planewire();
  
  // // Find the pedestal manually.
  waveform_tools::pedestal_computer pedcomp;
  for(const int16_t& x: waveform) pedcomp.fill(x);
  pedcomp.finish(10); // auto-adjusted rms.
  int16_t ped = pedcomp.ped();
  waveform._ped = ped;
  waveform._pedwidth =  pedcomp.pedsig();
  for(int16_t& x: waveform) x-=ped;

  
  // {
  //   boost::mutex::scoped_lock lock(sChanMutex);
  //   std::cout << "wirenum:" << wirenum << "\t ped: " << ped << " rms: " << waveform._pedwidth  << std::endl;
  // }
}





void UbdaqComposer::composeTPC()
{
  json reco_list;
  json r;
  
  if(!gPlexus.is_ok()) cerr << "Plexus not loaded!" << std::endl;
  // The big wire map.
    
  wireMap = std::shared_ptr<wiremap_t>(new wiremap_t(8256));
  noiseMap = std::shared_ptr<wiremap_t>(new wiremap_t(8256));
  TimeReporter timer("TPC");    
  
  bool superspeed = false;
  if( std::string::npos != m_options.find("_SUPERSPEED_")) superspeed=true;
  
  json hits;  
  {
    TimeReporter timer_read("TPCReadDAQ");  
    ThreadPool thread_pool(m_max_threads);
    
    // Loop through all channels.
    ub_EventRecord::tpc_map_t tpc_map = m_record->getTPCSEBMap();
    for( ub_EventRecord::tpc_map_t::const_iterator crate_it = tpc_map.begin(); crate_it != tpc_map.end(); crate_it++){
      //get the crateHeader/crateData objects
      int crate = crate_it->first; // This seems more reliable than the crate daq header.
      const tpc_crate_data_t& crate_data = crate_it->second;
      // std::unique_ptr<tpc_crate_data_t::ub_CrateHeader_t> const& crate_header = crate_data.crateHeader();

      boost::thread_group unpack_threads;    

      std::vector<tpc_crate_data_t::card_t> const& cards = crate_data.getCards();
      for(const tpc_crate_data_t::card_t& card_data: cards) {
        // const tpc_crate_data_t::card_t::ub_CardHeader_t& card_header = card_data.getHeader();
        int card = card_data.getModule();
      
        int num_card_channels = 0;
        
        
        const std::vector<tpc_crate_data_t::card_t::card_channel_type>& channels = card_data.getChannels();
        for( const tpc_crate_data_t::card_t::card_channel_type& channel_data : channels) {
          int channel       = channel_data.getChannelNumber();        
          num_card_channels++;
          // Find the wire number of this channel.
          const Plexus::Plek& p = gPlexus.get(crate,card,channel);
          int wire = p.wirenum();
          
          if(superspeed && (wire%4)!=0) continue;
          // std::cout << "found wire " << wire << std::endl;
          if(wire<0) continue;
          size_t nsamp = channel_data.data().size();

          // Waveform storage.
          waveform_ptr_t waveform_ptr = waveform_ptr_t(new waveform_t(nsamp));
          if(wire>=wireMap->size()) wireMap->resize(wire+1);
          if((*wireMap)[wire])  {
            cerr << "Two channels with wire number " << wire << " seem to have the same crate/card/channel map." << endl;
            continue;
          }
          (*wireMap)[wire] = waveform_ptr;          
          
          // unpack_channel(waveform_ptr,channel_data,p,hits);
          // unpack_threads.create_thread(boost::bind(unpack_channel,waveform_ptr,boost::cref(channel_data),
          //                                         boost::cref(p), boost::ref(hits)));
          thread_pool.AddJob(boost::bind(unpack_channel,waveform_ptr,boost::cref(channel_data),
                                                     boost::cref(p), boost::ref(hits)));
                                                     
        } // loop channels
        //unpack_threads.join_all();

      } // loop cards
    
      
    } // loop seb/crate
  
    thread_pool.JoinAll();
    timer_read.addto(m_stats);
  }

  timer.addto(m_stats);
}



//////////////////////////////////// Supernova mode


void unpack_channel_sn(waveform_ptr_t waveform_ptr, waveform_ptr_t noise_ptr, 
                    const tpc_sn_crate_data_t::card_t::card_channel_type& channel_data, 
                    const Plexus::Plek& plek,
                    json& outhits) 
{
  // Copy the channel data to my own signed vector array
  waveform_t& waveform = *waveform_ptr;
  waveform.reserve(3200);
  waveform_t& noiseform = *noise_ptr;
  noiseform.reserve(3200);
    
  int wirenum = plek.wirenum();
  waveform._servicecard = plek._servicecard_id;
  waveform._status = gDeadChannelMap->status(wirenum);
  waveform._plane = plek.plane();
  waveform._planewire = plek.planewire();
  
  // Go through packets.
  std::vector<int16_t> packet;
  packet.reserve(200); // Temporary storage; reusable and exapandable
  std::vector<json> hits;
  
  for(auto const& p: channel_data.packets_) {
    size_t tdc = p.header().getSampleNumber();
    if(p.data().size()==0) continue; // zero-sized packet. 
    packet.resize(0);
    
    p.decompress_into(packet,false); // False flag indicates unpacker shouldn't offset to tdc address in array when unpacking.
    
    // Remove built-in pedestal, using first word as pedestal.
    int16_t ped = *packet.begin();
    size_t  n = packet.size();

    // copy to output waveform
    if(waveform.size() < tdc+n) {
      waveform.resize(tdc+n,0);
      noiseform.resize(tdc+n,0x7fff); // Mask all as dead
    }
    for(size_t i=0;i<n;i++) {
      waveform[tdc+i] = packet[i]- ped;
      noiseform[tdc+i] = 0;         // unmask as good.
    }
        
    double sign = -1;
    if(waveform._plane==2) sign = 1;
    int thresh = 8; // close to what is used in regular data.
    waveform_tools::peak_finder pf(thresh,sign,3); // last is # of samples required over threshold.
    for(size_t i =0; i< n; i++) {
      pf(packet[i]-ped); // run through peakfinder
      
    }
    if(waveform._status <0 || waveform._status>=4) { // It's a good channel, or unlisted in channel map
      for(auto peak: pf) {
        json hit;
        hit["wire"] = waveform._planewire;
        hit["plane"] = waveform._plane;
        hit["q"] = peak.integral;
        hit["t"] = tdc+peak.tpeak;
        hit["t1"] = tdc+peak.tstart;
        hit["t2"] = tdc+peak.tstop;
        hits.push_back(hit);
      }
    }
  }
  {
    // Scope a lock.
    boost::mutex::scoped_lock lock(sChanMutex);
    for(size_t i=0;i<hits.size();i++) {
      outhits.push_back(hits[i]);
    }
  }
}



 
void UbdaqComposer::composeTPC_SN()
{
  json reco_list;
  json r;
  
  if(!gPlexus.is_ok()) cerr << "Plexus not loaded!" << std::endl;
  // The big wire map.
    
  wireMap = std::shared_ptr<wiremap_t>(new wiremap_t(8256));
  noiseMap = std::shared_ptr<wiremap_t>(new wiremap_t(8256));
  TimeReporter timer("TPC");    
  
  bool superspeed = false;
  if( std::string::npos != m_options.find("_SUPERSPEED_")) superspeed=true;

  json hits;
  
  // int nsamp_max = 3200;
  {
    TimeReporter timer_read("TPCReadDAQ_SN");  
    
    // Loop through all channels.
    ub_EventRecord::tpc_sn_map_t sn_map = m_record->getTpcSnSEBMap();
    for( auto const & seb_it: sn_map ) {
       //get the crateHeader/crateData objects
      int crate = seb_it.first;

      boost::thread_group unpack_threads;    

      for(auto const& card_data: (seb_it.second).getCards() ) {
        // const tpc_crate_data_t::card_t::ub_CardHeader_t& card_header = card_data.getHeader();
        int card = card_data.getModule();
        int num_card_channels = 0;
                
        for(auto const& channel_data : card_data.getChannels() ) {
          int channel       = channel_data.getChannelNumber();        
          num_card_channels++;
          // Find the wire number of this channel.
          const Plexus::Plek& p = gPlexus.get(crate,card,channel);
          int wire = p.wirenum();
          
          if(superspeed && (wire%4)!=0) continue;
          // std::cout << "found wire " << wire << std::endl;
          if(wire<0) continue;
  
          // Waveform storage.
          waveform_ptr_t waveform_ptr = waveform_ptr_t(new waveform_t(0));
          waveform_ptr_t noise_ptr    = waveform_ptr_t(new waveform_t(0,0x7fff));
          
          if(wire>=wireMap->size()) wireMap->resize(wire+1);
          if((*wireMap)[wire])  {
            cerr << "Two channels with wire number " << wire << " seem to have the same crate/card/channel map." << endl;
            continue;
          }
          (*wireMap)[wire] = waveform_ptr;    
          (*noiseMap)[wire] =   noise_ptr;    
          
          // unpack_channel(waveform_ptr,channel_data,plane,planewire,wire,hits);
          unpack_threads.create_thread(boost::bind(unpack_channel_sn,waveform_ptr,noise_ptr,boost::cref(channel_data),
                                                  boost::cref(p), boost::ref(hits)));
        } // loop channels
        unpack_threads.join_all();

      } // loop cards
    
    } // loop seb/crate
  
    timer_read.addto(m_stats);
  }
  
  
  // hits.
  cout << "Created " << hits.size() << " hits" << endl;  

  json hits_lists;
  hits_lists["snhits_SNDAQ__libargo"] = hits;
  m_result["hits"] = hits_lists;
  
  timer.addto(m_stats);
}

void UbdaqComposer::composeWireImages(bool noisefilter, const std::string& name)
{
  TimeReporter timer("createImageMaps");    
  
  // if( std::string::npos != m_options.find("_NORAW_")) {
  //   std::cout << "Not doing wire images." << std::endl;
  //   return;
  // }
  
  int ntdc = 0;
  int wires_read = 0;
  if(!wireMap) return; // nodata
  for(auto it: *wireMap) {
      if(it) {
        wires_read++;
        int nsamp = it->size();
        if(ntdc<nsamp) ntdc = nsamp;
      }
  }
  if(wires_read == 0) return; // no data.
    
  // Ensure uniform length. Can happen due to 0x503f issue.
  for(auto it: *wireMap) {
    if(it) it->resize(ntdc,0);
  }
  for(auto it: *noiseMap) {
    if(it) it->resize(ntdc,0x7fff);
  }
  // Now we should have a semi-complete map.
  fmintdc = 0;
  fmaxtdc = ntdc;
  int nwire = wireMap->size();

  cout << "Read " << wires_read << " wires, max TDC length " << ntdc << " doing noisefilter: " << (noisefilter?"true":"false") << "\n";
  if(noisefilter) CoherentNoiseFilter(wireMap,noiseMap,nwire,ntdc);
  
  int tilesize = m_request->value("tilesize",2400);
  std::cout << "Doing tilesize" << tilesize << std::endl;
  json r;
  MakeEncodedTileset(     r,
                            wireMap, 
                            noiseMap,
                            nwire,
                            ntdc,
                            m_current_event_dir_name,
                            m_current_event_url,
                            tilesize, false, m_max_threads);

  m_result["wireimg"] = json::object();
  m_result["wireimg"][name] = r;
    
  json r2;
  MakeLowres( r2,
                 wireMap,
                 noiseMap,
                 nwire,
                 ntdc, m_current_event_dir_name, m_current_event_url, tilesize, false, m_max_threads );
  m_result["wireimg-lowres"] = json::object();
  m_result["wireimg-lowres"]["wireimg_DAQ__libargoLowres"] = r2;
    
  
  timer.addto(m_stats);
}



void UbdaqComposer::composeHits()
{
  json hits = json::array();

  if(!wireMap) return;
  waveform_t zeroes;
  size_t nwire = wireMap->size();
  for(size_t iwire = 0; iwire<nwire; iwire++) {
    waveform_ptr_t wptr = (*wireMap)[iwire];
    waveform_t& waveform = *wptr;

    waveform_ptr_t nptr;
    if(noiseMap) nptr = (*noiseMap)[iwire];
    waveform_t& noiseform = zeroes;
    if(nptr) noiseform=*nptr;
    
    // Ensure matching size.  Should really only happen once.
    noiseform.resize(waveform.size(),0);

    if(waveform._status <0 || waveform._status>=4) { // It's a good channel, or unlisted in channel map
    
      // waveform_t::const_iterator it1;
      // waveform_t::const_iterator it2;
      // waveform_t::const_iterator end1 = waveform.end();
      
      // it1 = waveform.begin(); it2= noiseform.begin();
      // while(it1!=end1) {
      //   int16_t x = *it1 - *it2;
      //   ss += x*x;
      //   it1++; it2++;
      // }
      // double rms = sqrt(ss/(n-1.0));
      // pedestals have already been run.
      float rms = waveform._pedwidth;

      int thresh = ceil(4.0*rms);
      int sign = -1;
      if(waveform._plane==2) sign = 1;

      waveform_tools::peak_finder pf(thresh,sign,3); 

      // it1 = waveform.begin(); it2= noiseform.begin();
      // while(it1!=end1) {
      //   int16_t x = *it1 - *it2;
      //   pf(x);
      //   it1++; it2++;
      // }
      for(int16_t x : waveform) pf(x);
      pf.finish();
    
      double scale = 0.1;
      if(waveform._plane==2) scale=0.2;

      json wirehits = json::array();
      for(auto peak: pf) {
        json hit = { 
                      {"Ch", waveform._Ch}
                   // , {"wire", waveform._planewire}
                   // , {"plane", waveform._plane}
                   , {"q", peak.integral*scale}
                   , {"t", peak.tpeak}
                   , {"t1", peak.tstart}
                   , {"t2", peak.tstop}
                  };
        wirehits.push_back(hit);
      }
      {
        // Scope a lock, in case we're threading. Add this wire's hits onto the hit object.
        boost::mutex::scoped_lock lock(sChanMutex);
        hits.insert(hits.end(),wirehits.begin(),wirehits.end());
      }
      
    } // goodwire
  } // loop wires
  
  
  std::cout << "Created " << hits.size() << " hits" << std::endl;
  m_result["hits"] = {{"hits_DAQ__libargo", hits}};
}



uint32_t resolveFrame(uint32_t frameCourse,uint32_t frameFine, uint32_t bitmask)
{
  /// 
  /// Figure out the correct roll-over.  Given a frame number frameCourse which is usually the
  /// event readout frame, figure out which absolute frame number should be assigned to frameFine, 
  /// which contains only <bitmask> bits of specific information.
  /// eg. (0x100,0x1,0xf) resolves to 0x101, which is the nearest solution,
  /// but (0x100,0xe,0xF) resolves to 0x9e, which is closer.
  ///
  // note that modulus = bitmask + 1. E.g. bitmask=0x7 means modulus-8 arithmetic.
  // This could probably be optimized, but my brain is a little fuzzy today.
  uint32_t option1 = (frameCourse - (frameCourse & bitmask)) | (frameFine & bitmask);
  int max = (bitmask+1)/2; // This is half-way point; you should never be further than this.
  int diff = option1-frameCourse;
  if(diff >  max) return option1 - (bitmask+1);
  if(diff < -max) return option1 + (bitmask+1);
  return option1;
}


void UbdaqComposer::getPmtFromCrateCardChan(
  int icrate, int icard,int ichan, // channel input
  int& outPmt,  // pmt or optical detector number
  int& outGain, // gain of channel 1=low, 2=high
  std::string& outSpecial // special name
    )
{
  // This function is totally bogus, but it will at least give me a framework.
  (void)icrate; // unused parameter
  
  // if(icard<7) {
  //   outGain = -1;
  //   outPmt = -1;
  //   outSpecial = "";
  //   return;
  // }
  if(ichan<30) {    
    if(icard>7) outGain = 1; // low gain
    else        outGain = 2; // high gain
    outPmt = ichan;
  } 
  else {   
    outGain = -1;
    outPmt = -1;
    outSpecial = std::string("special_").append(std::to_string(ichan));
  }
  
}
  
void UbdaqComposer::composePMTs()
{
  TimeReporter timer("DAQPMTs");
  uint32_t  pmt_readout_frame_mod8  = 0xFFFFFFFF;
  uint32_t  pmt_readout_frame = 0xFFFFFFFF;
  uint32_t  pmt_readout_sample = 0xFFFFFFFF;

  
  std::map<std::string,json> ophits_lists;

  json jCrates;
  
  const ub_EventRecord::pmt_map_t& pmt_map = m_record->getPMTSEBMap();
  ub_EventRecord::pmt_map_t::const_iterator crate_it;
  for( crate_it = pmt_map.begin(); crate_it != pmt_map.end(); crate_it++){
    //get the crateHeader/crateData objects
    int crate = crate_it->first;
    const pmt_crate_data_t& crate_data = crate_it->second;
    std::unique_ptr<pmt_crate_data_t::ub_CrateHeader_t> const& crate_header = crate_data.crateHeader();
    
  
    json jCards;
    //now get the card map (for the current crate), and do a loop over all cards
    std::vector<pmt_crate_data_t::card_t> const& cards = crate_data.getCards();
    for(const pmt_crate_data_t::card_t& card_data: cards) {
      
      // const pmt_crate_data_t::card_t::header_type& card_header = card_data.header();
      int card = card_data.getModule();
      
      uint32_t pmt_event_frame      = card_data.getFrame();
      // uint32_t pmt_trig_frame_mod16 = card_data.getTrigFrameMod16();
      // uint32_t pmt_trig_frame       = card_data.getTrigFrame(); // The resolved version, fully specified.
      // uint32_t pmt_trig_sample_2MHz = card_data.getTrigSample();
      
      json jChannels;

      // Loop channels
  
      const std::vector<pmt_crate_data_t::card_t::card_channel_type>& channels = card_data.getChannels();
      for( const pmt_crate_data_t::card_t::card_channel_type& channel_data : channels) {
  
        int channel = channel_data.getChannelNumber();
        
        const Plexus::Plek& plek = gPlexus.get(crate,card,channel);
        // std::cout << plek.to_string() << std::endl;
        int pmt = plek.pmt();
        char gain = plek.gain();
        // if(gain!='H') continue;  // Ignore lowgain.
        if(pmt<0) continue;

        int nwindows = 0;
        // Loop windows.
        const std::vector<ub_PMT_WindowData_v6>& windows = channel_data.getWindows();
        for( const ub_PMT_WindowData_v6& window_data : windows) {
          nwindows ++;
          const ub_PMT_WindowHeader_v6& window_header = window_data.header();

          int disc = window_header.getDiscriminantor();
          uint32_t sample = window_header.getSample();
          
          // Where will these hits go?
          std::string collection = "DAQ_";
        
          if(plek._stream=="Beam" && disc != BEAM_GATE) continue; // Don't use.
          if(plek._stream=="Cosmic" && disc != COSMIC)  continue;  // Don't use.
          if(pmt<0){            
            collection += "special";
            if     (disc == COSMIC)    collection.append("_cosmic");
            else if(disc == BEAM_GATE) collection.append("_beam");                
          }else {
            if(plek.gain()=='H') collection += "HighGain";
            if(plek.gain()=='L') collection += "LowGain";
            if     (disc == COSMIC  && plek._stream=="Cosmic") collection.append("_Cosmic");
            else if(disc == BEAM_GATE && plek._stream=="Beam") collection.append("_Beam");
            else continue;            
          }          
          json &ophits = ophits_lists[collection];

          uint32_t frame = resolveFrame(pmt_event_frame,window_header.getFrame(),0x7);
          // for SN, no trigger, so guess.
          if(m_trig_frame ==0) m_trig_frame=frame;
          if( (pmt_readout_frame==0xFFFFFFFF) && ((disc&0x4)==4) ) {
            // Set the readout start time here.
            pmt_readout_frame_mod8  = window_header.getFrame();
            pmt_readout_frame = frame;
            pmt_readout_sample = sample;
          }
          // int nsamp = window_data.data().size();
          // int peaksamp = 0;
          // int peakval = 0;
          const ub_RawData& raw = window_data.data();          
          ub_RawData::const_iterator it;
          int ped = (*(raw.begin()))&0xfff;
          
          double pulseThreshold = 5;
          waveform_tools::peak_finder peakFinder(pulseThreshold); // last is # of samples required over threshold.

          for(it=raw.begin(); it!=raw.end(); it++) {
            double v = ((*it)&0xfff);
            float q = v - ped;
            peakFinder(q); // Process looking for peaks.
          }
          peakFinder.finish();

          for(const auto& peak: peakFinder) {
            uint32_t peak_sample = window_header.getSample() + peak.tpeak;
            double time_rel_trig = ( (((double)frame-(double)m_trig_frame)*102400.) + ((double)peak_sample-(double)m_trig_time_64MHz) ) / 64e6 * 1e9; // 64 mhz ticks, in ns
            json jobj;
            double pe = peak.height/2;       // Crude calibration: 2 ADC/pe low gain
            if(gain=='H') pe = peak.height/20; // 20 ADC/pe high gain
            jobj["ccc"] = (crate*1000 + card)*1000+channel;  
            jobj["stream"] = plek._stream;  
            
            jobj["opDetChan"     ] = pmt;
            jobj["opDetGain"     ] = std::string(1,gain);          
            jobj["disc"          ] = disc;
            jobj["peakTime"      ] = time_rel_trig; // nanoseconds

            jobj["frame"] = frame;
            jobj["sample"] = sample;
            jobj["pe"            ] = pe;
            jobj["peakAdc"            ] = peak.height;
            jobj["peakIntegral"       ] = peak.integral;
            
            // jobj["tpeak"] = peak.tpeak;            
            // jobj["peak_sample"] = peak_sample;
            // jobj["pmt_readout_frame"] = pmt_readout_frame;
            // jobj["pmt_readout_sample"] = pmt_readout_sample;
            // jobj["trig_frame"] = m_trig_frame;
            // jobj["trig_time"] = m_trig_time_64MHz;
          
            jobj["sample"] =  sample;
            jobj["frame"] = frame;
            
            ophits.push_back(jobj);
          
          }
        }
        json jChannel;
        jChannel["channel"] = channel;
        jChannel["nwindows"] = nwindows;
        jChannel["pmt"] = pmt;
        jChannel["gain"] = gain;
        jChannels.push_back(jChannel);
  
      } // loop channels
      
      json jCard;
      jCard["channels"] = jChannels;
      jCard["channels"] = jChannels;
      jCards.push_back(jCard);
    } // loop cards

    json jCrate;
    jCrate["cards"] = jCards;
    jCrate["crateNumber"] = crate_header->crate_number;
    jCrate["cardCount"] = crate_header->card_count;
    jCrate["sebSec"] = crate_header->local_host_time.seb_time_sec;
    jCrate["sebUsec"] = crate_header->local_host_time.seb_time_usec;
    jCrate["type"] = crate_header->crate_type;
    jCrate["eventNumber"] = crate_header->event_number;
    jCrate["frameNumber"] = crate_header->frame_number;
    jCrates.push_back(jCrate);
    
  } // Loop PMT crates
  json reco_list;
  for(auto& list: ophits_lists) {
    reco_list[list.first] = list.second;
  }
  m_result["ophits"] = reco_list;
  
  json jPMT;
  jPMT["crates"] = jCrates;   
  m_result["PMT"] = jPMT;   
  timer.addto(m_stats);  
}

void UbdaqComposer::composeLaser()
{
  // Protect against earlier versions of Datatypes without laser code. Remove this ifdef after it becomes final.
#ifdef _UBOONETYPES_LASERDATA_H
  const ub_EventRecord::laser_map_t& map = m_record->getLASERSEBMap();
  if(map.size() ==0) return;
  ub_EventRecord::laser_map_t::const_iterator laser_it;
  json jlaser;
  for( laser_it = map.begin(); laser_it != map.end(); laser_it++){
    json j;
    int index = laser_it->first;
    const ub_LaserData& data = laser_it->second;
    j["ID"] = data.getID();
    j["Status"] = data.getStatus();
    j["PositionRotary"] = data.getPositionRotary();
    j["PositionLinear"] = data.getPositionLinear();
    j["PositionAttenuator"] = data.getPositionAttenuator();
    j["PositionIris"] = data.getPositionIris();
    j["TimeSec"] = data.getTimeSec();
    j["TimeUSec"] = data.getTimeUSec();
    j["CountTrigger"] = data.getCountTrigger();
    j["CountRun"] = data.getCountRun();
    j["CountLaser"] = data.getCountLaser();
    j["TOMGBoxAxis1"] = data.getTOMGBoxAxis1();
    j["TOMGBoxAxis2"] = data.getTOMGBoxAxis2();
    j["TOMGFlangeAxis1"] = data.getTOMGFlangeAxis1();
    j["TOMGFlangeAxis2"] = data.getTOMGFlangeAxis2();
    jlaser[index]=j;
  };
  json reco_list;
  m_result["laser"] = jlaser;
  
#endif
}

std::string UbdaqComposer::form_event_descriptor()
{
  std::string s("ubdaq|");
  s.append(m_result["header"]["run"].dump());
  s.append("|");
  s.append(m_result["header"]["subrun"].dump());
  s.append("|");
  s.append(m_result["header"]["event"].dump());
  return s;
}

  
