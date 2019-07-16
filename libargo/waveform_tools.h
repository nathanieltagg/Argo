
#ifndef WAVEFORM_TOOLS_H_0A37EAD2
#define WAVEFORM_TOOLS_H_0A37EAD2



#include <vector>
#define _USE_MATH_DEFINES
#include <math.h>
#include <iostream>


namespace waveform_tools 
{
  
// digital biquad filter
// https://en.wikipedia.org/wiki/Digital_biquad_filter
struct digital_biquad
{
  digital_biquad() 
    :_a1(0),_a2(0),_b0(0),_b1(0),_b2(0),_x1(0),_x2(0),_y1(0),_y2(0)  {};
  
  double operator()(double x) { 
    double y = _b0*x + _b1*_x1 + _b2*_x2 - _a1*_y1 - _a2*_y2;
    _y2 = _y1; // Shift
    _y1 = y;    // Shift
    _x2 = _x1; // Shift
    _x1 = x;   // Shift
    return y;
  }
  
  // http://www.musicdsp.org/files/Audio-EQ-Cookbook.txt
  void set_lowpass(double f0, double Q) {
    double sinw0(sin(f0*2*M_PI));
    double cosw0(cos(f0*2*M_PI));
    double alpha(sinw0/(2*Q));
    double a0 = 1 + alpha;
    _b0 =  ((1 - cosw0)/2.) / a0;
    _b1 =  ( 1 - cosw0) / a0;
    _b2 =  ((1 - cosw0)/2.) / a0;
    _a1 =  (-2*cosw0) / a0;
    _a2 =  ( 1 - alpha) / a0;
    // Response function:
    // http://www.musicdsp.org/files/Audio-EQ-Cookbook.txt
    // H(s) = 1 / (s^2 + s/Q + 1)  where s is normalized frequency
  };
  void set_highpass(double f0, double Q) {
    double sinw0(sin(f0*2*M_PI));
    double cosw0(cos(f0*2*M_PI));
    double alpha(sinw0/(2*Q));
    double a0 = 1 + alpha;
    _b0 =  ((1 + cosw0)/2.) / a0;
    _b1 =  -(1 + cosw0) / a0;
    _b2 =  ((1 + cosw0)/2.) / a0;
    _a1 =  (-2*cosw0) / a0;
    _a2 =  ( 1 - alpha) / a0;
    // Response function:
    // http://www.musicdsp.org/files/Audio-EQ-Cookbook.txt
    // H(s) = s^2 / (s^2 + s/Q + 1)  where s is normalized frequency
  };
  
  double _a1,_a2,_b0,_b1,_b2,_x1,_x2,_y1,_y2;
};



struct peak
{
  int tstart;
  int tstop;
  int tpeak;
  int height;
  int integral;
};

struct peak_finder : public std::vector< peak >
{
  peak_finder( int thresh, int sign=1, int minsamp=1 ) : _thresh(thresh), _sign(sign), _minsamp(minsamp),
    _count(0), _on(false) { };
  
  void operator()(int x) 
  { 
    int _x = x*_sign;
    if(_x > _thresh) {
      // we're in a peak
      if(!_on) {
        // start.
        _on = true;
        _cur.tstart = _count;
        _cur.tpeak  = _count;
        _cur.height = _x;
        _cur.integral = _x;
      } else {
        // continue
        _cur.integral += _x;
        if(_x > _cur.height) _cur.height = _x;
      }
    } else {
      finish(); // save current peak if any
    }
    _count++;
  };
  
  void finish() {
    // Call this when you're done looping.
    if(_on) {  // finish current peak.
      _on = false;
      _cur.tstop = _count;
      if(_cur.tstop-_cur.tstart >= _minsamp)
        push_back(_cur);
    }
  }
  
  int _thresh; // Threshold for accepting a peak
  int _sign; // Threshold for accepting a peak
  int _minsamp; // minimum number of samples above threshold
  int _count;
  bool _on; // currently in a peak?
  peak _cur;
};


template<typename T>
struct peak_finder_with_running_baseline : public std::vector< peak >
{
  peak_finder_with_running_baseline( int thresh, int sign=1, int minsamp=1 ) : _thresh(thresh), _sign(sign), _minsamp(minsamp),
    _count(0), _on(false) { };
  
  void init(T x) { _running_median = x;}
  T median() { return _running_median;}
  
  void operator()(T x) 
  { 
    // running median.
    if(!_on) {
      if(x>_running_median) _running_median++;
      if(x<_running_median) _running_median--;
    }
    int _x = (x-_running_median)*_sign;
    if(_x > _thresh) {
      // we're in a peak
      if(!_on) {
        // start.
        _on = true;
        _cur.tstart = _count;
        _cur.tpeak  = _count;
        _cur.height = _x;
        _cur.integral = _x;
      } else {
        // continue
        _cur.integral += _x;
        if(_x > _cur.height) _cur.height = _x;
      }
    } else {
      finish(); // save current peak if any
    }
    _count++;
  };
  
  void finish() {
    // Call this when you're done looping.
    if(_on) {  // finish current peak.
      _on = false;
      _cur.tstop = _count;
      if(_cur.tstop-_cur.tstart >= _minsamp)
        push_back(_cur);
    }
  }
  
  T      _running_median;
  int _thresh; // Threshold for accepting a peak
  int _sign; // Threshold for accepting a peak
  int _minsamp; // minimum number of samples above threshold
  int _count;
  bool _on; // currently in a peak?
  peak _cur;
};


  
///
/// Used to find truncated pedestal and RMS of a set of numbers.
///
/// Uses a prebuilt vector as a histogram. Fast and furious!
///
struct pedestal_computer
{
  pedestal_computer() : _hist(0x1000,0), _ped_count(0), _ped(0), _pedsig(1e9), _pederr(1e9), _pedsigerr(1e9) {};
  void fill(uint16_t x) { 
     uint16_t xx = x&0xFFF;// Sanitize.
     uint16_t c = ++_hist[xx]; if(c>_ped_count) {_ped_count = c; _ped=xx; } 
   };
   void finish(int halfwidth = 10) // Pass estimated max width of pedestal here.
   {
    int low = _ped - halfwidth;
    int high = _ped + halfwidth;
    int lowbin = std::max(0,low);
    int highbin = std::min(0x1000,high);
    double sumsq = 0;
    double sum = 0;
    double n = 0;
    for(int i=lowbin;i<=highbin;i++) {
      double w = _hist[i];
      double x = i;
      n += w;
      sum += x*w;
      sumsq += x*x*w;
    }    
    if(n<1) return;
    double  var = fabs((sumsq - sum*sum/n)/(n-1.));
    double xrms = sqrt(var);
    if(xrms> halfwidth*0.45) finish(halfwidth*2); // Run this alg again.
    _pedsig = xrms;
    _pederr = xrms/sqrt(n); 
    _pedsigerr = var*var*2/(n-1);
  }
  
  uint16_t ped() { return _ped; }
  double pedsig() { return _pedsig; }
  double pederr() { return _pederr; }
  double pedsigerr() { return _pedsigerr; }

  std::vector<uint16_t> _hist;
  uint16_t _ped_count;
  uint16_t _ped;
  double _pedsig;
  double _pederr;
  double _pedsigerr;
};


// struct old_peak_finder
// {
//   peak_finder( double thresh, double sign=1 ) : _thresh(thresh), _sign(sign), _x1(0), _x2(0) {};
//
//   double operator()(double x)
//   {
//     // Returns PH for a pulse that occured at the LAST tick.
//     double pulse_height = 0;
//     double _x = (_sign*x);
//     if((_x1>_thresh) && (_x < _x1) && (_x2<_x1) ) {
//         pulse_height = _x;
//         // + _x1 + _x2; // sum the pulse of the last three ticks.
//     }
//     _x2 = _x1;
//     _x1 = _x;
//     return pulse_height;
//   };
//
//   double _thresh; // Threshold for accepting a peak
//   double _sign; // Threshold for accepting a peak
//   double _x1;     // last value.
//   double _x2;     // second last value.
// };

}

#endif /* end of include guard: WAVEFORM_TOOLS_H_0A37EAD2 */
