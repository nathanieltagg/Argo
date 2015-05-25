<!-- vertex shader -->
<script id="2d-vertex-shader" type="x-shader/x-vertex">
attribute vec2 a_position;
attribute vec2 a_texCoord;

uniform vec2 u_resolution;

varying vec2 v_texCoord;

void main() {
   // convert the rectangle from pixels to 0.0 to 1.0
   vec2 zeroToOne = a_position / u_resolution;

   // convert from 0->1 to 0->2
   vec2 zeroToTwo = zeroToOne * 2.0;

   // convert from 0->2 to -1->+1 (clipspace)
   vec2 clipSpace = zeroToTwo - 1.0;

   gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);

   // pass the texCoord to the fragment shader
   // The GPU will interpolate this value between points.
   v_texCoord = a_texCoord;
}
</script>




<script id="lutshade" type="x-shader/x-fragment">
precision mediump float;

uniform sampler2D texture;
uniform sampler2D maptexture;

varying vec2 v_texCoord;

void main() {
  // inc is now the RGBA color of the input pixel, with each color encoded as a float from 0 to 1.
  vec4 inc = texture2D(texture, v_texCoord);
  
  // 1d lookup.
  // float adc = 256.*(inc.r*255. + inc.g - 128.);  // True ADC value; typical -4096 to 4096.
  // adc *=10.; // Amplify so we can see detail - shouldn't need this in the final version.
  // float lookup_coord = adc/8192. + 0.5; // this is a proper 1:1 mapping, but doesn't use enough dynamic range.
  // vec2 lookup_coords = vec2(lookup_coord,0);
  
  // 2d lookup.
  // Just use r,g. Red is most-significant, green is least-significant.  X is least, Y is most.
  vec2 lookup_coords = vec2(inc.g,inc.r);
  
  
  // float adc = 0.999;
  vec4 color;
  color.r = texture2D(maptexture, lookup_coords).r;
  color.g = texture2D(maptexture, lookup_coords).g;
  color.b = texture2D(maptexture, lookup_coords).b;
  color.a = texture2D(maptexture, lookup_coords).a;

  // color.r =0.;
  // color.b =0.;
  // color.g =0.;
  // if(adc>0.)        { color.r = 1.0; }
  // else              { color.b = 1.0; }
  if(lookup_coords.x>1.0) {color.r = 0.; color.g = 255.; color.b = 0.;}
  if(lookup_coords.y>1.0) {color.r = 0.; color.g = 255.; color.b = 0.;}

  // Debug: This just draws our input texture.
  // color = texture2D(maptexture,v_texCoord);

  // Output color is RGBA color with colors encoded between 0 and 1.
  gl_FragColor = color;
}

</script>

<!-- simple blitter -->
<script id="2d-fragment-shader" type="x-shader/x-fragment">
precision mediump float;

// our texture
uniform sampler2D u_image;

// the texCoords passed in from the vertex shader.
varying vec2 v_texCoord;

void main() {
   gl_FragColor = texture2D(u_image, v_texCoord);
}
</script>
