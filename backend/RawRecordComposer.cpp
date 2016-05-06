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
#include <TTimeStamp.h>
#include <TLorentzVector.h>
#include "TBranchElement.h"
#include "TStreamerInfo.h"


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


#include "RawRecordComposer.h"
#include "JsonElement.h"
#include "TimeReporter.h"
//#include "ColorMap.h"
#include "MakePng.h"
#include "EncodedTileMaker.h"
#include "RootToJson.h"
#include "WirePalette.h"
#include <stdlib.h>
#include <sys/stat.h>

#include "datatypes/ub_EventRecord.h"

#include "boost/thread/thread.hpp"
#include "waveform_tools.h"
#include "GetSloMonDB.h"

using namespace std;
using namespace gov::fnal::uboone::datatypes;
using gov::fnal::uboone::online::Plexus;

gov::fnal::uboone::online::Plexus gPlexus;


RawRecordComposer::RawRecordComposer(JsonObject& output,   
                                      std::shared_ptr<gov::fnal::uboone::datatypes::ub_EventRecord> record, 
                                      const std::string options)
  : fOutput(output)
  , fRecord(record)
  , fOptions(options)
  , fmintdc(0)
  , fmaxtdc(0)
{

  fCacheStoragePath     = "../live_event_cache";
  fCacheStorageUrl      = "live_event_cache";
  fWorkingSuffix = "working";
  fFinalSuffix   = "event";
  fCreateSubdirCache = true;
};
  
RawRecordComposer::~RawRecordComposer()
{
}


void RawRecordComposer::compose()
{
  // have the record unpack itself.
  //fRecord->updateIOMode(IO_GRANULARITY_CHANNEL);
  if(!fRecord) {
    fOutput.add("error","Bad record!");
    return;
  } 
  
  std::string id = Form("r%08d_s%04d_e%08d"
                            ,fRecord->getGlobalHeader().getRunNumber()    
                            ,fRecord->getGlobalHeader().getSubrunNumber() 
                            ,fRecord->getGlobalHeader().getEventNumber()  
                            );
  
  if(fCreateSubdirCache) {
    fCurrentEventDirname = Form("%s/%s.%s/" // Will get renamed to .event on closeout.
                              ,fCacheStoragePath.c_str(), id.c_str(),fWorkingSuffix.c_str());
    fCurrentEventUrl      = Form("%s/%s.%s/"
                              ,fCacheStorageUrl.c_str(), id.c_str(),fFinalSuffix.c_str());
  
    ::umask(0000); // need this first??
    ::mkdir(fCurrentEventDirname.c_str(),0777);
  } else {
    fCurrentEventDirname = fCacheStoragePath;
    fCurrentEventUrl     = fCacheStorageUrl;
  }
  


  
  composeHeader();

  // Start DB lookups.  
  GetSlowMonDB slm(event_time);
  boost::thread slomon_thread(slm);
  slm();
  
  try{ composeTPC(); } catch(...) { std::cerr << "Caught exception in composeTPC();" << std::endl; }
  try{ composePMTs(); } catch(...) { std::cerr << "Caught exception in composePMTs();" << std::endl; }
  composeLaser();
  
  // Database lookup.
  slomon_thread.join();
  
  JsonElement hv; hv.setStr(slm.val);
  fOutput.add("hv",hv);  
  fOutput.add("stats",fStats);
  

}


 
  
double getTime(std::shared_ptr<gov::fnal::uboone::datatypes::ub_EventRecord> record, JsonObject& header)
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

  header.add("seconds",sec);
  header.add("microSeconds",usec);
  header.add("nanoSeconds",nsec);
  double daqtime = (sec + usec*1e-6 + nsec*1e-9) * 1000; // in ms
  header.add("eventTime",daqtime); // in ms.

  return daqtime;
}

  
bool getTriggerData(std::shared_ptr<gov::fnal::uboone::datatypes::ub_EventRecord> record, JsonObject& trig)
{
  
   // get trigger card data.
  const ub_EventRecord::trig_map_t trigmap = record->getTRIGSEBMap();
  if(trigmap.size()==0) {
    return false;
  }
  auto const& trigger = record->getTRIGSEBMap().begin()->second;
  auto const& ch = trigger.crateHeader();
  auto const& trigger_cards = trigger.getCards();
  trig.add("trigger_cards",trigger_cards.size());
  // Fixme: look at GPS 
  if(trigger_cards.size()<1) return true;;
  auto const& trigger_header = trigger_cards.begin()->header();
  auto const& trigger_channels = trigger_cards.begin()->getChannels();
  if(trigger_channels.size()<1) return true;;
  auto const& trigger_data = trigger_channels.begin()->header();
  
  trig.add("triggerword",( (trigger_data.trig_data_1) + ((uint32_t)(trigger_data.trig_data_2) << 16) ) );
  trig.add("frame",trigger_header.getFrame());
  trig.add("sample_2MHz",trigger_header.get2MHzSampleNumber());
  trig.add("sample_16MHz",((trigger_header.get2MHzSampleNumber())<<3) + trigger_header.get16MHzRemainderNumber());
  JsonArray sw_triggers;


  std::vector<ub_FEMBeamTriggerOutput> const& sw_trigger_list = record->getSWTriggerOutputVector();
  for(auto const& swtrig: sw_trigger_list) {
    if(swtrig.pass) sw_triggers.add(swtrig.algo_instance_name);
  }
  trig.add("sw_triggers",sw_triggers);
  return true;
}



void RawRecordComposer::composeHeader()
{
  JsonObject header;

  // GET THE TIME
  event_time = getTime(fRecord,header)/1000.;
  if(event_time>0) gPlexus.rebuild(event_time);

  header.add("run"           ,fRecord->getGlobalHeader().getRunNumber()    );
  header.add("subrun"        ,fRecord->getGlobalHeader().getSubrunNumber() );
  header.add("event"         ,fRecord->getGlobalHeader().getEventNumber()  );
  
  
  // Get trigger info.
  
  // header.add("seconds",fRecord->getGlobalHeader().getSeconds());
  // header.add("microSeconds",fRecord->getGlobalHeader().getMicroSeconds());
  // header.add("nanoSeconds",fRecord->getGlobalHeader().getNanoSeconds());
  header.add("recordOrigin", fRecord->getGlobalHeader().getRecordOrigin());
  
  header.add("isRealData",1);
  header.add("DAQVersionLabel",fRecord->getGlobalHeader().getDAQVersionLabel());
  header.add("DAQVersionQualifiers",fRecord->getGlobalHeader().getDAQVersionQualifiers());
  
  // trigger data.
  JsonObject trig;
  getTriggerData(fRecord,trig);
  header.add("trigger",trig);
  
  
  fOutput.add("header",header);  
}


boost::mutex sChanMutex;
  

void unpack_channel(waveform_ptr_t waveform_ptr, const tpc_crate_data_t::card_t::card_channel_type& channel_data, 
                    const Plexus::Plek& plek,
                    JsonArray& outhits) 
{
  // Copy the channel data to my own signed vector array
  waveform_t& waveform = *waveform_ptr;
  waveform.reserve(9600);
  channel_data.decompress(waveform);
  size_t nsamp = waveform.size();
  
  int wirenum = plek.wirenum();
  int plane = plek.plane();
  int planewire = plek.planewire();
  waveform._servicecard = plek._servicecard_id;
  
  // // Find the pedestal manually.
  waveform_tools::pedestal_computer pedcomp;
  for(int i=0;i<nsamp;i++) pedcomp.fill(waveform[i]);
  int ped = pedcomp.ped();
  double rms = pedcomp.rms(100); // auto-adjusted rms.

  double thresh = ceil(4.0*rms);
  waveform._pedwidth = std::min(rms*2.0,15.0); 
  double sign = -1;
  if(plane==2) sign = 1;

  waveform_tools::peak_finder pf(thresh,sign,3); // last is # of samples required over threshold.
  for(size_t i =0; i< nsamp; i++) {
    assert(waveform[i]>=0);
    assert(waveform[i]<4096);
    waveform[i] -= ped;
    assert(waveform[i]>-4096);
    assert(waveform[i]<4096);
    pf(waveform[i]);
  }
    
  for(auto peak: pf) {
    JsonObject hit;
    hit.add("wire",planewire);
    hit.add("plane",plane);
    hit.add("q",peak.integral);
    hit.add("wirenum",wirenum);
    hit.add("t",peak.tpeak);
    hit.add("t1",peak.tstart);
    hit.add("t2",peak.tstop);
    {
      // Scope a lock.
      boost::mutex::scoped_lock lock(sChanMutex);
      std::string str = hit.str();
      outhits.add(hit);
    }
  }
  
  // {
  //   boost::mutex::scoped_lock lock(sChanMutex);
  //   std::cout << "wirenum:" << wirenum << "\t ped: " << ped << " rms: " << rms << " hits" << pf.size() << std::endl;
  // }
}
 
void RawRecordComposer::composeTPC()
{
  JsonObject reco_list;
  JsonObject r;
  
  if(!gPlexus.is_ok()) cerr << "Plexus not loaded!" << std::endl;
  // The big wire map.
    
  JsonObject jTPC;
  JsonArray jCrates;

  std::shared_ptr<wiremap_t> wireMap(new wiremap_t);
  int ntdc = 0;
  TimeReporter timer("TPC");    
  
  bool superspeed = false;
  if( std::string::npos != fOptions.find("_SUPERSPEED_")) superspeed=true;
  
  int wires_read = 0;
  JsonArray hits;
  
  
  {
    TimeReporter timer_read("TPCReadDAQ");  
    
    // Loop through all channels.
    ub_EventRecord::tpc_map_t tpc_map = fRecord->getTPCSEBMap();
    for( ub_EventRecord::tpc_map_t::const_iterator crate_it = tpc_map.begin(); crate_it != tpc_map.end(); crate_it++){
      //get the crateHeader/crateData objects
      int crate = crate_it->first; // This seems more reliable than the crate daq header.
      const tpc_crate_data_t& crate_data = crate_it->second;
      std::unique_ptr<tpc_crate_data_t::ub_CrateHeader_t> const& crate_header = crate_data.crateHeader();

      JsonArray jCards;
      boost::thread_group unpack_threads;    

      std::vector<tpc_crate_data_t::card_t> const& cards = crate_data.getCards();
      for(const tpc_crate_data_t::card_t& card_data: cards) {
        // const tpc_crate_data_t::card_t::ub_CardHeader_t& card_header = card_data.getHeader();
        int card = card_data.getModule();
      
        JsonObject jCard;
        jCard.add("cardId",crate);
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
          std::pair<wiremap_t::iterator,bool> inserted;
          waveform_ptr_t waveform_ptr = waveform_ptr_t(new waveform_t(nsamp));
          inserted = wireMap->insert(wiremap_t::value_type(wire, waveform_ptr));
          if(!inserted.second) {
            cerr << "Two channels with wire number " << wire << " seem to have the same crate/card/channel map." << endl;
            continue;
          }
          // waveform_t& waveform = *(inserted.first->second.get());
          
          
          // unpack_channel(waveform_ptr,channel_data,plane,planewire,wire,hits);
          unpack_threads.create_thread(boost::bind(unpack_channel,waveform_ptr,boost::cref(channel_data),
                                                  boost::cref(p), boost::ref(hits)));
        } // loop channels
        unpack_threads.join_all();

        jCard.add("num_channels",num_card_channels);
        jCards.add(jCard);        
      } // loop cards
    
      JsonObject jCrate;
      jCrate.add("cards",jCards);
      jCrate.add("crateNumber",crate);
      jCrate.add("sebSec",crate_header->local_host_time.seb_time_sec);
      jCrate.add("sebUsec",crate_header->local_host_time.seb_time_usec);
      jCrate.add("type",crate_header->crate_type);
      jCrate.add("eventNumber",crate_header->event_number);
      jCrate.add("frameNumber",crate_header->frame_number);
      jCrate.add("cardCount",crate_header->card_count);
      jCrates.add(jCrate);
      
    } // loop seb/crate
  
    timer_read.addto(fStats);
  }
  

  
  
  if( std::string::npos != fOptions.find("_NORAW_")) {
    std::cout << "Not doing wire images." << std::endl;
    reco_list.add("DAQ",JsonElement());
    fOutput.add("raw",reco_list);    
  } else {
    for(auto it: *wireMap) {
      wires_read++;
      int nsamp = it.second->size();
      if(ntdc<nsamp) ntdc = nsamp;
    }
    // Ensure uniform length. Can happen due to 0x503f issue.
    for(auto it: *wireMap) {
      it.second->resize(ntdc,0);
    }
    
    // Now we should have a semi-complete map.
    fmintdc = 0;
    fmaxtdc = ntdc;
    int nwire = 1 + wireMap->rbegin()->first;
  
    if(wires_read<=0) { cerr << "Got no wires!" << std::endl; return;}
    cout << "Read " << wires_read << " wires, max TDC length " << ntdc << "\n";
    MakeEncodedTileset(     r,
                            wireMap, 
                            nwire,
                            ntdc,
                            fCurrentEventDirname,
                            fCurrentEventUrl,
                            fOptions);

    reco_list.add("DAQ",r);
    fOutput.add("raw",reco_list);
    
    {
      JsonObject r2;
      TimeReporter lowres_stats("time_to_make_lowres");
      MakeLowres( r2,
                     wireMap, 
                     nwire,
                     ntdc, fCurrentEventDirname, fCurrentEventUrl, fOptions, false );
      JsonObject reco_list2;
      reco_list2.add("DAQ",r2);
      fOutput.add("raw_lowres",reco_list2);
    }
    
  }
  
    
  jTPC.add("crates",jCrates);
  fOutput.add("TPC",jTPC);


  // hits.
  cout << "Created " << hits.length() << " hits" << endl;
  cout.flush();
  
  JsonObject hits_lists;
  hits_lists.add("DAQ",hits);
  fOutput.add("hits",hits_lists);
  
  timer.addto(fStats);
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


void RawRecordComposer::getPmtFromCrateCardChan(
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
  
void RawRecordComposer::composePMTs()
{
  TimeReporter timer("DAQPMTs");
  uint32_t  pmt_readout_frame_mod8  = 0xFFFFFFFF;
  uint32_t  pmt_readout_frame = 0xFFFFFFFF;
  uint32_t  pmt_readout_sample = 0xFFFFFFFF;

  JsonArray ophits;

  JsonArray jCrates;
  
  const ub_EventRecord::pmt_map_t& pmt_map = fRecord->getPMTSEBMap();
  ub_EventRecord::pmt_map_t::const_iterator crate_it;
  for( crate_it = pmt_map.begin(); crate_it != pmt_map.end(); crate_it++){
    //get the crateHeader/crateData objects
    int crate = crate_it->first;
    const pmt_crate_data_t& crate_data = crate_it->second;
    std::unique_ptr<pmt_crate_data_t::ub_CrateHeader_t> const& crate_header = crate_data.crateHeader();
    
  
    JsonArray jCards;
    //now get the card map (for the current crate), and do a loop over all cards
    std::vector<pmt_crate_data_t::card_t> const& cards = crate_data.getCards();
    for(const pmt_crate_data_t::card_t& card_data: cards) {
      
      const pmt_crate_data_t::card_t::header_type& card_header = card_data.header();
      int card = card_data.getModule();
      
      uint32_t pmt_event_frame      = card_data.getFrame();
      uint32_t pmt_trig_frame_mod16 = card_data.getTrigFrameMod16();
      uint32_t pmt_trig_frame       = card_data.getTrigFrame(); // The resolved version, fully specified.
      uint32_t pmt_trig_sample_2MHz = card_data.getTrigSample();
      
      JsonArray jChannels;

      // Loop channels
  
      const std::vector<pmt_crate_data_t::card_t::card_channel_type>& channels = card_data.getChannels();
      for( const pmt_crate_data_t::card_t::card_channel_type& channel_data : channels) {
  
        int channel = channel_data.getChannelNumber();
        int pmt;
        int gain;
        std::string special;
        getPmtFromCrateCardChan(crate, card, channel, pmt, gain, special);
        
        int nwindows = 0;
        // Loop windows.
        const std::vector<ub_PMT_WindowData_v6>& windows = channel_data.getWindows();
        for( const ub_PMT_WindowData_v6& window_data : windows) {
          nwindows ++;
          const ub_PMT_WindowHeader_v6& window_header = window_data.header();

          int disc = window_header.getDiscriminantor();
          // if((disc&0x3)>0)      nwindows_disc++;
          // if((disc&0x4) == 0x4) nwindows_beam++;

          uint32_t frame = resolveFrame(pmt_event_frame,window_header.getFrame(),0x7);
          uint32_t sample = window_header.getSample();
          if( (pmt_readout_frame==0xFFFFFFFF) && ((disc&0x4)==4) ) {
            // Set the readout start time here.
            pmt_readout_frame_mod8  = window_header.getFrame();
            pmt_readout_frame = frame;
            pmt_readout_sample = sample;
          }
          int nsamp = window_data.data().size();
          int peaksamp = 0;
          int peakval = 0;
          ub_RawData::const_iterator it = window_data.data().begin();
          int ped = (*it)&0xfff;
          double sumw  = 0;
          double sumwx = 0;
          double sumwxx = 0;
          for(int j=0;j<nsamp;j++) {
            double val = (*it&0xfff) - ped;
            it++;
            sumw += val;
            sumwx += val*j;
            sumwxx += val*j*j;
            if(val>peakval) {peakval = val; peaksamp = j;}
          }
          if(sumw==0) sumw = 1e-9;
          double meanTime = sumwx/sumw;
          double widthTime = sqrt(fabs(sumwxx/sumw - meanTime*meanTime));
          double peakTime = ( ((frame-pmt_readout_frame)*102400.) + (peaksamp+sample-pmt_readout_sample) ) / 64e6; // 64 mhz ticks
          
        
          double pe = sumw/2;       // Crude calibration: 2 ADC/pe low gain
          if(gain==2) pe = sumw/20; // 20 ADC/pe high gain
          
          JsonObject jobj;
          jobj.add("ccc"     ,(crate*1000 + card)*1000+channel);      
          jobj.add("opDetChan"     ,pmt);
          jobj.add("opDetGain"     ,gain);          
          if(special.length()>0) 
            jobj.add("opDetSpecial"  ,special);          
          jobj.add("disc",disc);
          jobj.add("peakTime"      ,peakTime*1e9); // nanoseconds
          jobj.add("pe"            ,pe);
          jobj.add("sample", sample);
          jobj.add("frame",frame);
          ophits.add(jobj);
                    
        }
        
        JsonObject jChannel;
        jChannel.add("channel",channel);
        jChannel.add("nwindows",nwindows);
        jChannel.add("pmt",pmt);
        jChannel.add("gain",gain);
        if(special.length()) jChannel.add("special",special);
        jChannels.add(jChannel);
  
      } // loop channels
      
      JsonObject jCard;
      jCard.add("card",card);
      jCard.add("channels",jChannels);
      jCards.add(jCard);
    } // loop cards

    JsonObject jCrate;
    jCrate.add("cards",jCards);
    jCrate.add("crateNumber",crate_header->crate_number);
    jCrate.add("cardCount",crate_header->card_count);
    jCrate.add("sebSec",crate_header->local_host_time.seb_time_sec);
    jCrate.add("sebUsec",crate_header->local_host_time.seb_time_usec);
    jCrate.add("type",crate_header->crate_type);
    jCrate.add("eventNumber",crate_header->event_number);
    jCrate.add("frameNumber",crate_header->frame_number);
    jCrates.add(jCrate);
    
  } // Loop PMT crates
  JsonObject reco_list;
  reco_list.add("DAQ",ophits);
  fOutput.add("ophits",reco_list);
  
  JsonObject jPMT;
  jPMT.add("crates",jCrates);   
  fOutput.add("PMT",jPMT);   
  timer.addto(fStats);
}

void RawRecordComposer::composeLaser()
{
  // Protect against earlier versions of Datatypes without laser code. Remove this ifdef after it becomes final.
#ifdef _UBOONETYPES_LASERDATA_H
  const ub_EventRecord::laser_map_t& map = fRecord->getLASERSEBMap();
  if(map.size() ==0) return;
  ub_EventRecord::laser_map_t::const_iterator laser_it;
  JsonObject jlaser;
  for( laser_it = map.begin(); laser_it != map.end(); laser_it++){
    JsonObject j;
    int index = laser_it->first;
    const ub_LaserData& data = laser_it->second;
    j.add("ID",data.getID());
    j.add("Status",data.getStatus());
    j.add("PositionRotary",data.getPositionRotary());
    j.add("PositionLinear",data.getPositionLinear());
    j.add("PositionAttenuator",data.getPositionAttenuator());
    j.add("PositionIris",data.getPositionIris());
    j.add("TimeSec",data.getTimeSec());
    j.add("TimeUSec",data.getTimeUSec());
    j.add("CountTrigger",data.getCountTrigger());
    j.add("CountRun",data.getCountRun());
    j.add("CountLaser",data.getCountLaser());
    j.add("TOMGBoxAxis1",data.getTOMGBoxAxis1());
    j.add("TOMGBoxAxis2",data.getTOMGBoxAxis2());
    j.add("TOMGFlangeAxis1",data.getTOMGFlangeAxis1());
    j.add("TOMGFlangeAxis2",data.getTOMGFlangeAxis2());
    jlaser.add(std::to_string(index),j);
  };
  JsonObject reco_list;
  fOutput.add("laser",jlaser);
  
#endif
}

  
