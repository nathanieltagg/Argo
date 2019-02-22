#include "CoherentNoiseFilter.h"
#include "TimeReporter.h"

#include "boost/thread/thread.hpp"
#include <algorithm>
#include <functional>

// const int kWiresToAverage = 48;
void OneWireCoherentNoiseFilter( std::shared_ptr< std::vector<waveform_ptr_t> > input_wires_ptr,  waveform_ptr_t noise_ptr, int ntdc)
{
  // cast for convenience
  std::vector<waveform_ptr_t>& input_wires = *input_wires_ptr;

  // Compose the median waveform.
  size_t n = input_wires.size();
  if(n==0) return;
  std::vector<int16_t> values(n);
  waveform_t& noise = *noise_ptr;
  
  
  for(size_t tdc =0; tdc<ntdc; tdc++) {
    for(size_t i=0;i<n;i++) {
      waveform_ptr_t w = input_wires[i];
      values[i] = (*w)[tdc];
    }
    std::nth_element(values.begin(), values.begin()+n/2, values.end());
    noise[tdc] = values[n/2];
    
  }
}

void CoherentNoiseFilter(
  std::shared_ptr<wiremap_t> wireMap, 
  std::shared_ptr<wiremap_t> noiseWireMap,                         
  size_t nwires,
  size_t ntdc )
{
  TimeReporter tr("CoherentNoiseFilter");
  boost::thread_group threads;    
  
  noiseWireMap->resize(nwires);
  
  // This algorithm builds noise in 48-wire chunks:
  int iwire_start = 0;
  int iwire_end = 0;
  while(iwire_end<(int)nwires) {
    iwire_start = iwire_end;
    // What servicecard are we starting on?
    auto firstwire = (*wireMap)[iwire_start];
    if(!(firstwire)) {iwire_end++; continue;} // Skip missing wire objects.
    int servicecard = 0;
    servicecard = firstwire->_servicecard;
    
    // Make a noisewire waveform to store.
    waveform_ptr_t noise_ptr(new waveform_t(ntdc,0));
    // build a list for input, add this noisewire to output.
    std::shared_ptr< std::vector<waveform_ptr_t> > input_wires(new std::vector<waveform_ptr_t>());
    
    // Look at all the wires in sequence
    for(iwire_end=iwire_start;iwire_end<nwires;iwire_end++) {
      auto wf = (*wireMap)[iwire_end];
      if(!wf) continue; // skip missing wires.
      if(wf->_servicecard!=servicecard) break; 
      // wire exists and has matching servicecard.
      
      // Only use it for noise computation if the wire status is OK - not a bad channel.
      int status = wf->_status;
      if(status<0 || status>=4)
        input_wires->push_back(wf);
      (*noiseWireMap)[iwire_end] = noise_ptr;
    }
        
    threads.create_thread(boost::bind(OneWireCoherentNoiseFilter,input_wires,noise_ptr,ntdc));
    // OneWireCoherentNoiseFilter(iwire,servicecard,wireMap,noise_ptr,nwires,ntdc);
  }
  threads.join_all();
  

  // This algorithm builds noise across all channels of a servicecard, regardless of plane.
  /*
  std::map<int, int> servicecards;
  for(int iwire=0;iwire<(int)nwires;iwire++) {    
    int sc = (*wireMap)[iwire]->_servicecard;
    servicecards[sc]=1;
  }
  
  // Iterate servicecards.
  for(auto& it: servicecards) {
    int sc = it.first;
    // Make a noisewire waveform to store.
    waveform_ptr_t noise_ptr(new waveform_t(ntdc));
    // build a list for input, add this noisewire to output.
    std::shared_ptr< std::vector<waveform_ptr_t> > input_wires(new std::vector<waveform_ptr_t>());
    
    for(int iwire=0;iwire<(int)nwires;iwire++) {
      if(sc == (*wireMap)[iwire]->_servicecard) {
        input_wires->push_back((*wireMap)[iwire]);
        (*noiseWireMap)[iwire] = noise_ptr;        
      }        
    }
    threads.create_thread(boost::bind(OneWireCoherentNoiseFilter,input_wires,noise_ptr,ntdc));    
  }
  threads.join_all();
  */

  
  // This algorithm builds a 48-channel average around the current wire.  //
  // for(int iwire = 0;iwire<nwires;iwire++) {
  //   // TimeReporter timer_read("one wire noise");
  //
  //   waveform_ptr_t inwire = (*wireMap)[iwire];
  //   if(!inwire) continue;
  //
  //   waveform_ptr_t noise_ptr(new waveform_t(ntdc));
  //   (*noiseWireMap)[iwire] = noise_ptr;
  //
  //   int servicecard = inwire->_servicecard;
  //
  //
  //   // Find the correct assembly of input wires.
  //   std::shared_ptr< std::vector<waveform_ptr_t> > input_wires(new std::vector<waveform_ptr_t>());
  //
  //   bool done = false;
  //   bool done_left = false;
  //   bool done_right = false;
  //   int ilwire = iwire;
  //   int irwire = iwire;
  //   size_t n = 0;
  //
  //   while(!done) {
  //     ilwire--;
  //     irwire++;
  //     if(ilwire>=0 && !done_left) {
  //       waveform_ptr_t w = (*wireMap)[ilwire];
  //       if(w) {
  //         if( w->_servicecard== servicecard ) {
  //           input_wires->push_back(w); n++;
  //         } else {
  //           done_left = true;
  //         }
  //       }
  //     } else { done_left = true; }
  //
  //     if(irwire<nwires && !done_right) {
  //       waveform_ptr_t w = (*wireMap)[irwire];
  //       if(w) {
  //         if( w->_servicecard== servicecard ) {
  //           input_wires->push_back(w); n++;
  //         } else {
  //           done_right = true;
  //         }
  //       }
  //     } else { done_right = true; }
  //
  //     // Keep going until we've exhausted both left and right
  //     // OR we've gotten a total of 48 input wires, not including our own.
  //     if(done_left && done_right) done = true;
  //     if(n>kWiresToAverage) done = true;
  //   }
  //
  //
  //   threads.create_thread(boost::bind(OneWireCoherentNoiseFilter,input_wires,noise_ptr,ntdc));
  //   // OneWireCoherentNoiseFilter(iwire,servicecard,wireMap,noise_ptr,nwires,ntdc);
  // }
  // threads.join_all();

}