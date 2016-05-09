#include "CoherentNoiseFilter.h"
#include "TimeReporter.h"

#include "boost/thread/thread.hpp"
#include <algorithm>
#include <functional>

const int kWiresToAverage = 48;
void OneWireCoherentNoiseFilter( std::shared_ptr< std::vector<waveform_ptr_t> > input_wires_ptr,  waveform_ptr_t noise_ptr, int ntdc)
{
  // cast for convenience
  std::vector<waveform_ptr_t>& input_wires = *input_wires_ptr;

  // Compose the median waveform.
  size_t n = input_wires.size();
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
  
  // This algorithm builds noise in 48-wire chunks
  int iwire_start = 0;
  int iwire_end = 0;
  while(iwire_end<(int)nwires) {
    iwire_start = iwire_end;
    iwire_end = iwire_start;
    // What servicecard are we starting on?
    int servicecard = (*wireMap)[iwire_start]->_servicecard;
    // ok, find the logical stopping place on the same servicecard, up to 48 wires away
    while( (iwire_end < iwire_start+kWiresToAverage)                  // less than 48 wires
              && (*wireMap)[iwire_end]                                // there exists a wire to look at
              && (*wireMap)[iwire_end]->_servicecard == servicecard) // The service card matches
                iwire_end++; // advance
    
    std::cout << "Noise grouping: " << iwire_end-iwire_start << ":" << iwire_start << " to " << iwire_end << std::endl;
    // Make a noisewire waveform to store.
    waveform_ptr_t noise_ptr(new waveform_t(ntdc));
    // build a list for input, add this noisewire to output.
    std::shared_ptr< std::vector<waveform_ptr_t> > input_wires(new std::vector<waveform_ptr_t>());
    for(int iwire = iwire_start; iwire<iwire_end; iwire++) {
      input_wires->push_back((*wireMap)[iwire]);
      (*noiseWireMap)[iwire] = noise_ptr;
    }
    threads.create_thread(boost::bind(OneWireCoherentNoiseFilter,input_wires,noise_ptr,ntdc));
    // OneWireCoherentNoiseFilter(iwire,servicecard,wireMap,noise_ptr,nwires,ntdc);
  }
  threads.join_all();
  
  
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